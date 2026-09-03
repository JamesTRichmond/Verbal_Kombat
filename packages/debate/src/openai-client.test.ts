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
});
