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

import type { ChatClient, ChatMessage } from './llm.js';

export interface OpenAiChatClientOptions {
  apiKey: string;
  /** Defaults to https://api.openai.com/v1 */
  baseUrl?: string;
  /** Model id, e.g. gpt-4o-mini, llama-3.1-70b */
  model: string;
  /** Optional fetch override (tests inject a mock). */
  fetch?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
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

  async complete(
    messages: ChatMessage[],
    callOpts?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: this.opts.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: callOpts?.maxTokens ?? 300,
      temperature: callOpts?.temperature ?? 0.8,
    };

    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as ChatCompletionResponse;

    if (!res.ok) {
      const msg = data.error?.message ?? res.statusText;
      throw new Error(`OpenAI chat completion failed (${res.status}): ${msg}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenAI chat completion returned empty content');
    }
    return content;
  }
}
