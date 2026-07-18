import { beforeEach, describe, expect, it } from 'vitest';
import { newMatch, MAX_INTEGRITY, type ArgumentEvent, type JudgeVerdict, type MatchConfig } from '@vk/core';
import { applyVerdict, _resetEventIds } from './mapper.js';

const config: MatchConfig = {
  id: 'm1',
  topic: 'test topic',
  stances: { A: 'for', B: 'against' },
  fighters: { A: 'socrates_prime', B: 'silver_tongue' },
  mode: 'exhibition',
};

function arg(side: 'A' | 'B', text: string, seq = 1): ArgumentEvent {
  return { id: `a${seq}`, matchId: 'm1', side, text, seq, t: seq * 1000 };
}

function verdict(overrides: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {
    argumentId: 'a1',
    side: 'A',
    soundness: 0.8,
    relevance: 0.8,
    evidence: 0.5,
    structure: 0.7,
    fallacies: [],
    rebuttalForce: 0,
    rationale: 'test',
    ...overrides,
  };
}

beforeEach(() => _resetEventIds());

describe('applyVerdict', () => {
  it('maps a short clean point to a jab that damages the opponent', () => {
    const state = newMatch(config);
    const events = applyVerdict(state, arg('A', 'Short sharp point.'), verdict());
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('jab');
    expect(events[0]!.damage).toBeGreaterThan(0);
    expect(state.sides.B.integrity).toBeLessThan(MAX_INTEGRITY);
    expect(state.sides.A.integrity).toBe(MAX_INTEGRITY);
  });

  it('maps a long multi-premise argument to a heavy attack', () => {
    const state = newMatch(config);
    const long = 'Premise one is established by observation. '.repeat(6);
    const events = applyVerdict(state, arg('A', long), verdict());
    expect(events[0]!.type).toBe('heavy');
    expect(events[0]!.damage).toBeGreaterThan(6);
  });

  it('maps a devastating rebuttal to a launcher', () => {
    const state = newMatch(config);
    const events = applyVerdict(state, arg('A', 'Your premise collapses.'), verdict({ rebuttalForce: 0.9 }));
    expect(events[0]!.type).toBe('launcher');
    expect(events[0]!.label).toBe('DEVASTATING REBUTTAL');
  });

  it('chains consecutive sound arguments into combos', () => {
    const state = newMatch(config);
    applyVerdict(state, arg('A', 'First clean point.', 1), verdict());
    const events = applyVerdict(state, arg('A', 'Second clean point building on it.', 2), verdict());
    expect(events[0]!.type).toBe('combo_hit');
    expect(events[0]!.combo).toBe(2);
    expect(events[0]!.label).toBe('COMBO x2');
  });

  it('turns a strawman into a labeled block with zero damage', () => {
    const state = newMatch(config);
    const events = applyVerdict(
      state,
      arg('B', 'So you claim we should abandon everything.'),
      verdict({ side: 'B', fallacies: ['strawman'], soundness: 0.2 }),
    );
    expect(events[0]!.type).toBe('labeled_block');
    expect(events[0]!.label).toBe('STRAWMAN — BLOCKED');
    expect(events[0]!.damage).toBe(0);
    expect(state.sides.A.integrity).toBe(MAX_INTEGRITY);
  });

  it('makes ad hominem backfire with chip self-damage', () => {
    const state = newMatch(config);
    const events = applyVerdict(
      state,
      arg('B', 'Only a fool would believe that.'),
      verdict({ side: 'B', fallacies: ['ad_hominem'], soundness: 0.1 }),
    );
    expect(events[0]!.type).toBe('backfire');
    expect(events[0]!.selfDamage).toBeGreaterThan(0);
    expect(state.sides.B.integrity).toBeLessThan(MAX_INTEGRITY);
  });

  it('fallacies reset the combo counter', () => {
    const state = newMatch(config);
    applyVerdict(state, arg('A', 'Clean.', 1), verdict());
    applyVerdict(state, arg('A', 'Clean again.', 2), verdict());
    expect(state.sides.A.combo).toBe(2);
    applyVerdict(state, arg('A', 'Everyone agrees with me.', 3), verdict({ fallacies: ['appeal_to_popularity'] }));
    expect(state.sides.A.combo).toBe(0);
  });

  it('a closer that lands on a weakened opponent becomes a finisher and ends the match', () => {
    const state = newMatch(config);
    state.sides.B.integrity = 14;
    const events = applyVerdict(state, arg('A', 'And so the whole edifice falls.'), verdict(), {}, true);
    expect(events[0]!.type).toBe('finisher');
    expect(state.sides.B.integrity).toBe(0);
    expect(state.phase).toBe('complete');
    expect(state.winner).toBe('A');
  });
});
