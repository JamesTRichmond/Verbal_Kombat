import { describe, it, expect } from 'vitest';
import { LlmAgent, type ChatClient, type ChatMessage } from './llm.js';
import type { DebateContext } from './agent.js';
import type { FighterArchetype } from '@vk/core';

const archetype = {
  id: 'socrates_prime',
  name: 'Socrates Prime',
  title: 'The Interrogator',
  description: 'Questions assumptions.',
  traits: {
    interrogation: 0.9,
    empiricism: 0.2,
    formalism: 0.4,
    rhetoric: 0.3,
    patience: 0.5,
    aggression: 0.4,
  },
} as FighterArchetype;

function ctx(): DebateContext {
  return {
    matchId: 'm1',
    topic: 'Free will',
    stance: 'Free will is an illusion',
    side: 'A',
    archetype,
    history: [],
  };
}

class StreamingStub implements ChatClient {
  async complete(_messages: ChatMessage[]): Promise<string> {
    return 'full line';
  }
  async *stream(_messages: ChatMessage[]): AsyncIterable<string> {
    yield 'Free ';
    yield 'will is ';
    yield 'an illusion.';
  }
}

class CompleteOnlyStub implements ChatClient {
  async complete(_messages: ChatMessage[]): Promise<string> {
    return '  Opening case.  ';
  }
}

describe('LlmAgent.nextArgumentStream', () => {
  it('yields growing prefixes then the trimmed final line', async () => {
    const agent = new LlmAgent(new StreamingStub());
    const parts: string[] = [];
    for await (const p of agent.nextArgumentStream(ctx())) parts.push(p);
    expect(parts[0]).toBe('Free ');
    expect(parts[1]).toBe('Free will is ');
    expect(parts[2]).toBe('Free will is an illusion.');
    expect(parts.at(-1)).toBe('Free will is an illusion.');
  });

  it('falls back to a single yield when the client has no stream()', async () => {
    const agent = new LlmAgent(new CompleteOnlyStub());
    const parts: string[] = [];
    for await (const p of agent.nextArgumentStream(ctx())) parts.push(p);
    expect(parts).toEqual(['Opening case.']);
  });
});
