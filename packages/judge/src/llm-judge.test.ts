import { describe, expect, it } from 'vitest';
import type { ArgumentEvent } from '@vk/core';
import type { ChatClient, ChatMessage } from '@vk/debate';
import { LlmJudge } from './llm-judge.js';

function arg(overrides: Partial<ArgumentEvent> = {}): ArgumentEvent {
  return {
    id: 'a1',
    matchId: 'm1',
    side: 'A',
    text: 'Only a fool would deny the data.',
    seq: 1,
    t: 1000,
    ...overrides,
  };
}

class ScriptedClient implements ChatClient {
  constructor(private readonly reply: string) {}
  async complete(_messages: ChatMessage[]): Promise<string> {
    return this.reply;
  }
}

describe('LlmJudge', () => {
  it('parses a well-formed JSON verdict and clamps scores', async () => {
    const client = new ScriptedClient(
      JSON.stringify({
        soundness: 0.15,
        relevance: 0.6,
        evidence: 0.2,
        structure: 0.3,
        fallacies: ['ad_hominem'],
        rebuttalForce: 0,
        rationale: 'Attacks the person, not the claim.',
      }),
    );
    const judge = new LlmJudge(client);
    const v = await judge.evaluate(arg(), []);
    // A verdict carries no `kind` — that belongs to the Judge, not its output.
    expect((v as { kind?: unknown }).kind).toBeUndefined();
    expect(v.argumentId).toBe('a1');
    expect(v.side).toBe('A');
    expect(v.soundness).toBe(0.15);
    expect(v.fallacies).toEqual(['ad_hominem']);
    expect(v.rationale).toContain('person');
  });

  it('strips markdown fences and drops unknown fallacy ids', async () => {
    const client = new ScriptedClient(
      '```json\n{"soundness":1.5,"relevance":-1,"evidence":0.5,"structure":0.5,"fallacies":["ad_hominem","made_up"],"rebuttalForce":0.2,"rationale":"ok"}\n```',
    );
    const judge = new LlmJudge(client);
    const v = await judge.evaluate(arg(), []);
    expect(v.soundness).toBe(1);
    expect(v.relevance).toBe(0);
    expect(v.fallacies).toEqual(['ad_hominem']);
  });

  it('returns neutral floor scores when the model output is not JSON', async () => {
    const client = new ScriptedClient('I refuse to score this.');
    const judge = new LlmJudge(client);
    const v = await judge.evaluate(arg(), []);
    expect(v.fallacies).toEqual([]);
    expect(v.soundness).toBe(0.4);
    expect(v.rationale).toMatch(/unparseable/i);
  });

  it('includes prior history in the user message sent to the client', async () => {
    let captured: ChatMessage[] = [];
    const client: ChatClient = {
      async complete(messages) {
        captured = messages;
        return JSON.stringify({
          soundness: 0.7,
          relevance: 0.8,
          evidence: 0.6,
          structure: 0.7,
          fallacies: [],
          rebuttalForce: 0.5,
          rationale: 'Engages the prior point.',
        });
      },
    };
    const prior = arg({
      id: 'a0',
      side: 'B',
      text: 'Free will is an illusion given determinism.',
      seq: 0,
      t: 0,
    });
    const judge = new LlmJudge(client);
    await judge.evaluate(arg({ text: 'Determinism does not entail the absence of agency.' }), [prior]);
    const user = captured.find((m) => m.role === 'user');
    expect(user?.content).toContain('Free will is an illusion');
    expect(user?.content).toContain('Determinism does not entail');
  });
});
