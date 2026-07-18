import { describe, expect, it } from 'vitest';
import { entryAt, xpForMatch, rewardSignal, type MatchConfig } from '@vk/core';
import { FREE_WILL, ScriptedAgent, synthesizeProblemFighter, resolveProblemOutcome } from '@vk/debate';
import { ScriptAwareJudge, HeuristicJudge } from '@vk/judge';
import { runMatch } from './runner.js';

const config: MatchConfig = {
  id: 'demo',
  topic: FREE_WILL.topic,
  stances: FREE_WILL.stances,
  fighters: { A: 'socrates_prime', B: 'silver_tongue' },
  mode: 'exhibition',
};

function agents() {
  return { A: new ScriptedAgent(FREE_WILL, 'A'), B: new ScriptedAgent(FREE_WILL, 'B') } as const;
}

const isCloser = (a: { text: string }) =>
  FREE_WILL.lines.find((l) => l.text === a.text)?.annotations?.isCloser === true;

describe('runMatch over the scripted free-will debate', () => {
  it('plays the full script and produces a complete annotated replay', async () => {
    const { state, replay } = await runMatch(config, agents(), new ScriptAwareJudge(FREE_WILL), { isCloser });

    expect(state.phase).toBe('complete');
    expect(replay.entries.length).toBe(FREE_WILL.lines.length);
    // Every entry links argument ↔ verdict ↔ combat — the scrub index.
    for (const e of replay.entries) {
      expect(e.verdict.argumentId).toBe(e.argument.id);
      for (const c of e.combat) expect(c.sourceArgumentId).toBe(e.argument.id);
    }
  });

  it('punishes every authored fallacy with a failed attack', async () => {
    const { replay } = await runMatch(config, agents(), new ScriptAwareJudge(FREE_WILL), { isCloser });
    const fallacious = replay.entries.filter((e) => e.verdict.fallacies.length > 0);
    expect(fallacious.length).toBe(3); // ad hominem, strawman, appeal to authority/popularity
    for (const e of fallacious) {
      expect(e.combat[0]!.damage).toBe(0);
      expect(['whiff', 'labeled_block', 'backfire']).toContain(e.combat[0]!.type);
    }
  });

  it('declares a winner and awards xp that penalizes fallacies', async () => {
    const { replay } = await runMatch(config, agents(), new ScriptAwareJudge(FREE_WILL), { isCloser });
    expect(replay.winner).toBeDefined();
    const xpA = xpForMatch(replay, 'A');
    const xpB = xpForMatch(replay, 'B');
    expect(xpA.total).toBeGreaterThan(0);
    expect(xpB.total).toBeGreaterThan(0);
    const fallacyLineA = xpA.breakdown.find((b) => b.reason === 'fallacies committed');
    expect(fallacyLineA!.amount).toBeLessThan(0);
    // Reward signal stays in bounds for the RL harness.
    for (const side of ['A', 'B'] as const) {
      const r = rewardSignal(replay, side);
      expect(r).toBeGreaterThanOrEqual(-1);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('scrub index resolves a fight time back to the exchange that caused it', async () => {
    const { replay } = await runMatch(config, agents(), new ScriptAwareJudge(FREE_WILL), { isCloser });
    const third = replay.entries[2]!;
    expect(entryAt(replay, third.argument.t)).toBe(third);
    expect(entryAt(replay, third.argument.t + 1)).toBe(third);
  });

  it('heuristic judge catches the authored ad hominem unaided', async () => {
    const { replay } = await runMatch(config, agents(), new HeuristicJudge(), { isCloser });
    const adHom = replay.entries.find((e) => e.argument.text.includes('Only a fool'));
    expect(adHom!.verdict.fallacies).toContain('ad_hominem');
  });
});

describe('problem mode', () => {
  it('synthesizes a fighter from a described problem', () => {
    const { archetype, stance } = synthesizeProblemFighter({
      description: 'I cannot decide whether to leave my stable job for my startup.',
      question: 'Should I leave now, wait a year, or abandon the startup?',
    });
    expect(archetype.name).toBe('The Tangle');
    expect(stance).toContain('cannot be cleanly resolved');
  });

  it('extracts a reasoned outcome only when the user side wins cleanly', async () => {
    const { replay } = await runMatch(config, agents(), new ScriptAwareJudge(FREE_WILL), { isCloser });
    const userSide = replay.winner!;
    const outcome = resolveProblemOutcome(replay, userSide);
    expect(outcome).not.toBeNull();
    expect(outcome!.keyArgumentIds.length).toBeGreaterThan(0);
    // The losing side has not produced sound reasoning — no outcome.
    expect(resolveProblemOutcome(replay, userSide === 'A' ? 'B' : 'A')).toBeNull();
  });
});
