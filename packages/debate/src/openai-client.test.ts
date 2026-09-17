import { describe, it, expect, vi } from 'vitest';
import { OpenAiChatClient } from './openai-client.js';
import type { ChatMessage } from './llm.js';

describe('OpenAiChatClient', () => {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a debater.' },
    { role: 'user', content: 'Opening argument.' },
  ];

  it('requires apiKey and model', () => {
    expect(() => new OpenAiChatClient({ apiKey: '', model: 'x' })).toThrow(/apiKey/);
    expect(() => new OpenAiChatClient({ apiKey: 'k', model: '' })).toThrow(/model/);
  });

  it('POSTs to /chat/completions and returns message content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '  Free will is an illusion.  ' } }],
      }),
    });

    const client = new OpenAiChatClient({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const text = await client.complete(messages, { maxTokens: 100, temperature: 0.5 });
    expect(text).toBe('  Free will is an illusion.  ');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.5);
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual(messages);
  });

  it('strips trailing slash on baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    const client = new OpenAiChatClient({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://example.com/v1/',
      fetch: fetchMock as unknown as typeof fetch,
    });
    await client.complete(messages);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://example.com/v1/chat/completions');
  });

  it('throws on HTTP error with provider message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    const client = new OpenAiChatClient({
      apiKey: 'bad',
      model: 'm',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.complete(messages)).rejects.toThrow(/401.*Invalid API key/);
  });

  it('throws on empty content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: null } }] }),
    });

    const client = new OpenAiChatClient({
      apiKey: 'k',
      model: 'm',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(client.complete(messages)).rejects.toThrow(/empty content/);
  });

  it('streams SSE deltas then stops at [DONE]', async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"Free "}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"will."}}]}\n\n' +
      'data: [DONE]\n\n';
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body,
    });

    const client = new OpenAiChatClient({
      apiKey: 'k',
      model: 'm',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const chunks: string[] = [];
    for await (const c of client.stream(messages)) chunks.push(c);
    expect(chunks).toEqual(['Free ', 'will.']);

    const bodySent = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(bodySent.stream).toBe(true);
  });

  it('with a reasoning budget: adds it to max_tokens, sends reasoning, drops temperature', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const client = new OpenAiChatClient({
      apiKey: 'sk-test',
      model: 'anthropic/claude-fable-5.1',
      baseUrl: 'https://openrouter.ai/api/v1',
      reasoning: { maxTokens: 4000 },
      fetch: fetchMock as unknown as typeof fetch,
    });
    await client.complete(messages, { maxTokens: 700, temperature: 0.6 });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.max_tokens).toBe(4700);
    expect(body.reasoning).toEqual({ max_tokens: 4000 });
    expect(body.temperature).toBeUndefined();
  });

  it('retries once with more headroom when the answer comes back empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: [{ type: 'text', text: 'second try' }] } }] }) });
    const client = new OpenAiChatClient({ apiKey: 'sk-test', model: 'm', fetch: fetchMock as unknown as typeof fetch });
    expect(await client.complete(messages, { maxTokens: 300 })).toBe('second try');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(second.max_tokens).toBe(1200);
  });

  it('gives up after two empty answers', async () => {
    const empty = { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: null }, finish_reason: 'length' }] }) };
    const fetchMock = vi.fn().mockResolvedValue(empty);
    const client = new OpenAiChatClient({ apiKey: 'sk-test', model: 'm', fetch: fetchMock as unknown as typeof fetch });
    await expect(client.complete(messages)).rejects.toThrow(/empty content twice/);
  });
});
