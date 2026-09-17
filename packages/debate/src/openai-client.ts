/**
 * OpenAI-compatible ChatClient.
 *
 * Binds LlmAgent (and future LlmJudge) to any provider that speaks the
 * OpenAI chat-completions shape: OpenAI, Azure OpenAI, Groq, Together,
 * local vLLM/Ollama with OpenAI compatibility, etc.
 *
 * Caller supplies apiKey / baseUrl (typically from env). Never hardcode
 * secrets; this module never reads process.env itself so tests stay pure.
 */

import type { ChatCallOptions, ChatClient, ChatMessage } from './llm.js';

export interface OpenAiChatClientOptions {
  apiKey: string;
  /** Defaults to https://api.openai.com/v1 */
  baseUrl?: string;
  /** Model id, e.g. gpt-4o-mini, llama-3.1-70b */
  model: string;
  /** Optional fetch override (tests inject a mock). */
  fetch?: typeof fetch;
  /**
   * Extended thinking (OpenRouter / Anthropic-style `reasoning`). The budget
   * is added on top of every call's max_tokens so the answer is never
   * squeezed out by the thinking, and temperature is dropped because
   * reasoning models fix it.
   */
  reasoning?: { maxTokens?: number; effort?: 'low' | 'medium' | 'high' | 'xhigh' };
}

type ContentPart = { type?: string; text?: string };

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | ContentPart[] | null };
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}

/** Providers return content as a string or as an array of text parts. */
function contentText(content: string | ContentPart[] | null | undefined): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => p?.text ?? '').join('');
  return '';
}

export class OpenAiChatClient implements ChatClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: OpenAiChatClientOptions) {
    if (!opts.apiKey) throw new Error('OpenAiChatClient requires apiKey');
    if (!opts.model) throw new Error('OpenAiChatClient requires model');
    this.baseUrl = (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.fetchFn = opts.fetch ?? fetch;
  }

  async complete(messages: ChatMessage[], callOpts?: ChatCallOptions): Promise<string> {
    const data = await this.post(messages, callOpts, false);
    const choice = data.choices?.[0];
    const content = contentText(choice?.message?.content);
    if (content.trim()) return content;

    // Empty answer. Reasoning models can spend the whole token cap thinking
    // (finish_reason "length" with no text), and any provider can hiccup once.
    // Retry a single time with generous headroom before giving up.
    const base = callOpts?.maxTokens ?? 300;
    const retry = await this.post(messages, { ...callOpts, maxTokens: base * 2 + 600 }, false);
    const again = contentText(retry.choices?.[0]?.message?.content);
    if (again.trim()) return again;
    throw new Error(
      `OpenAI chat completion returned empty content twice (finish_reason: ${choice?.finish_reason ?? 'unknown'} then ${retry.choices?.[0]?.finish_reason ?? 'unknown'})`,
    );
  }

  async *stream(messages: ChatMessage[], callOpts?: ChatCallOptions): AsyncIterable<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify(this.body(messages, callOpts, true)),
    });

    if (!res.ok) {
      let msg = res.statusText;
      try {
        const data = (await res.json()) as ChatCompletionResponse;
        msg = data.error?.message ?? msg;
      } catch {
        /* keep statusText */
      }
      throw new Error(`OpenAI chat completion failed (${res.status}): ${msg}`);
    }

    if (!res.body) {
      throw new Error('OpenAI chat completion stream returned no body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        let parsed: ChatCompletionResponse;
        try {
          parsed = JSON.parse(payload) as ChatCompletionResponse;
        } catch {
          continue;
        }
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) yield delta;
      }
    }
  }

  private body(messages: ChatMessage[], callOpts: ChatCallOptions | undefined, stream: boolean) {
    const answerTokens = callOpts?.maxTokens ?? 300;
    const reasoning = this.opts.reasoning;
    if (!reasoning) {
      return {
        model: this.opts.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: answerTokens,
        temperature: callOpts?.temperature ?? 0.8,
        stream,
      };
    }
    const budget = reasoning.maxTokens ?? 0;
    return {
      model: this.opts.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: answerTokens + budget,
      reasoning: {
        ...(reasoning.maxTokens !== undefined ? { max_tokens: reasoning.maxTokens } : {}),
        ...(reasoning.effort !== undefined ? { effort: reasoning.effort } : {}),
      },
      stream,
    };
  }

  private async post(
    messages: ChatMessage[],
    callOpts: ChatCallOptions | undefined,
    stream: boolean,
  ): Promise<ChatCompletionResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify(this.body(messages, callOpts, stream)),
    });

    const data = (await res.json()) as ChatCompletionResponse;

    if (!res.ok) {
      const msg = data.error?.message ?? res.statusText;
      throw new Error(`OpenAI chat completion failed (${res.status}): ${msg}`);
    }
    return data;
  }
}
