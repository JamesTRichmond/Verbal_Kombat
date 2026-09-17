/**
 * MockChatClient — a deterministic, offline ChatClient.
 *
 * It reads the system prompt to decide what kind of answer is wanted:
 *  - proposal prompts ("Return ONLY JSON ... answer") → valid proposal JSON
 *    whose impacts use the criterion ids listed in the prompt;
 *  - judge prompts ("You are the Judge") → a neutral JSON verdict;
 *  - anything else → a debate move built around the stance in the prompt.
 *
 * Personalities:
 *  - "good": structured, evidence-flavoured, engages the opponent.
 *  - "sloppy": thin assertions, and (by default) fallacy trigger phrases the
 *    HeuristicJudge detects.
 *
 * Growth: learned "Never use …" lessons in the system prompt lower the
 * fallacy rate, so offline fighters visibly improve with training.
 */

import type { ChatCallOptions, ChatClient, ChatMessage } from '@vk/debate';

export type MockPersonality = 'good' | 'sloppy';

export interface MockChatClientOptions {
  seed?: number;
  personality?: MockPersonality;
  /** Chance (0..1) that a debate move contains a fallacy phrase. Defaults: good 0, sloppy 0.6. */
  fallacyRate?: number;
  /** How optimistic proposal probabilities are (0..1). Default 0.5. */
  optimism?: number;
}

/** mulberry32 — tiny seeded PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Phrases that match HeuristicJudge's FALLACY_MARKERS. */
export const FALLACY_PHRASES = [
  'Everybody knows this already.',
  'Allow the other view and the next thing you know nothing works at all.',
  'Only a fool would deny it.',
  'No one has ever proven otherwise.',
  'Imagine the suffering if we ignore this.',
  'No true expert would disagree.',
];

/** Fallacy-rate multiplier per learned avoid_fallacy lesson in the system prompt. */
export const LESSON_DISCIPLINE = 0.75;

const GOOD_OPENERS = [
  'Consider the evidence first.',
  'Start from the premise we can check.',
  'Look at what the data shows.',
];

const GOOD_BODIES = [
  'Because {stance}, the documented cases show the benefit holds when the conditions are met; therefore the burden now sits with the other side.',
  'When the measured results are compared across studies, then the pattern is consistent, so it follows that {stance}.',
  'The research found the effect repeatedly; since the premise survives testing, the conclusion that {stance} is warranted.',
];

const GOOD_REBUTTALS = [
  'However, your premise assumes what it needs to prove, and the data shows otherwise.',
  'But note what just happened: your argument skipped the evidence entirely.',
  'Yet your position leaves the strongest counter-example untouched.',
];

const SLOPPY_BODIES = [
  'Honestly {stance}.',
  'It is obvious that {stance}.',
  'I just feel {stance}, that is all.',
];

export class MockChatClient implements ChatClient {
  readonly personality: MockPersonality;
  private readonly rand: () => number;
  private readonly fallacyRate: number;
  private readonly optimism: number;
  calls = 0;

  constructor(opts: MockChatClientOptions = {}) {
    this.personality = opts.personality ?? 'good';
    this.rand = seededRandom(opts.seed ?? 1);
    this.fallacyRate = opts.fallacyRate ?? (this.personality === 'sloppy' ? 0.6 : 0);
    this.optimism = opts.optimism ?? 0.5;
  }

  async complete(messages: ChatMessage[], _opts?: ChatCallOptions): Promise<string> {
    this.calls++;
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (/Return ONLY JSON/i.test(system) && /"answer"/.test(system)) return this.proposal(system, messages);
    if (/You are the Judge/i.test(system)) return this.verdict();
    return this.debateMove(system, messages);
  }

  async *stream(messages: ChatMessage[], opts?: ChatCallOptions): AsyncIterable<string> {
    const text = await this.complete(messages, opts);
    for (const word of text.split(/(?<= )/)) yield word;
  }

  private pick<T>(xs: readonly T[]): T {
    const x = xs[Math.floor(this.rand() * xs.length)];
    if (x === undefined) throw new Error('MockChatClient: empty choice list');
    return x;
  }

  private debateMove(system: string, messages: ChatMessage[]): string {
    const stanceLine = system.match(/Your stance, which you must defend: (.*)/)?.[1] ?? 'my position holds';
    const stance = lowerFirst(stanceLine.trim().replace(/[.!?]+$/, ''));
    const hasOpponent = messages.some((m) => m.role === 'user' && !/^Present your opening/.test(m.content));
    const parts: string[] = [];

    if (this.personality === 'good') {
      if (hasOpponent) parts.push(this.pick(GOOD_REBUTTALS));
      else parts.push(this.pick(GOOD_OPENERS));
      parts.push(this.pick(GOOD_BODIES).replace('{stance}', stance));
    } else {
      parts.push(this.pick(SLOPPY_BODIES).replace('{stance}', stance));
    }
    // Growth: every "avoid this fallacy" lesson in the prompt makes the mock a bit more careful.
    const avoidLessons = (system.match(/^- Never use /gm) ?? []).length;
    const rate = this.fallacyRate * Math.pow(LESSON_DISCIPLINE, avoidLessons);
    if (this.rand() < rate) parts.push(this.pick(FALLACY_PHRASES));
    return parts.join(' ');
  }

  private proposal(system: string, messages: ChatMessage[]): string {
    const criteria = [...system.matchAll(/^- ([\w-]+): /gm)].map((m) => m[1]!).filter(Boolean);
    const problem = (messages.find((m) => m.role === 'user')?.content ?? '').replace(/^Problem:\s*/, '');
    const lens = system.match(/Your lens: ([^(]+)\(/)?.[1]?.trim() ?? 'this lens';
    const move = system.match(/Your move: ([^.]+)\./)?.[1]?.trim() ?? 'examine it';
    const impacts = (sign: number, strength: number) =>
      Object.fromEntries(
        criteria
          .filter(() => this.rand() < 0.7)
          .map((id) => [id, round2(sign * strength * (0.3 + 0.7 * this.rand()))]),
      );
    const pGood = round2(Math.min(0.95, Math.max(0.05, this.optimism * 0.6 + this.rand() * 0.4)));
    const payload = {
      answer: `Through ${lens}: ${move.toLowerCase()} before committing — then act on "${truncate(problem, 80)}" in a small, reversible step.`,
      reasoning: `Applied the move "${move}" to the problem and kept the step reversible.`,
      outcomes: [
        { description: 'The step works and builds momentum', probability: pGood, impacts: impacts(1, 0.9) },
        { description: 'The step stalls and costs time', probability: round2(1 - pGood), impacts: impacts(-1, 0.5) },
      ],
    };
    const json = JSON.stringify(payload);
    return this.personality === 'sloppy' ? `Sure! Here is my proposal:\n${json}` : json;
  }

  private verdict(): string {
    const base = this.personality === 'good' ? 0.7 : 0.4;
    return JSON.stringify({
      soundness: round2(base + this.rand() * 0.2),
      relevance: 0.7,
      evidence: round2(base * 0.8),
      structure: round2(base),
      fallacies: [],
      rebuttalForce: 0.2,
      rationale: 'Mock verdict.',
    });
  }
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
