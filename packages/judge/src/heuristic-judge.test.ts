import { describe, expect, it } from 'vitest';
import type { ArgumentEvent } from '@vk/core';
import { HeuristicJudge } from './judge.js';

function arg(text: string): ArgumentEvent {
  return { id: 'a1', matchId: 'm1', side: 'A', text, seq: 1, t: 1000 };
}

describe('HeuristicJudge fallacy detection', () => {
  const judge = new HeuristicJudge();

  it('flags no true scotsman', async () => {
    const v = await judge.evaluate(arg('No true skeptic would ever accept that shoddy study.'), []);
    expect(v.fallacies).toContain('no_true_scotsman');
    expect(v.soundness).toBeLessThan(0.3); // fallacies gut soundness
  });

  it('flags appeal to ignorance', async () => {
    const v = await judge.evaluate(arg('No one has proven me wrong, so my position stands.'), []);
    expect(v.fallacies).toContain('appeal_to_ignorance');
  });

  it('flags false cause', async () => {
    const v = await judge.evaluate(
      arg('Ever since we changed the policy, crime fell, so the policy caused it.'),
      [],
    );
    expect(v.fallacies).toContain('false_cause');
  });

  it('flags tu quoque, red herring, and hasty generalization', async () => {
    const tq = await judge.evaluate(arg('You do it too, so you cannot criticize the practice.'), []);
    expect(tq.fallacies).toContain('tu_quoque');
    const rh = await judge.evaluate(arg('Forget the claim — that is not the real issue here.'), []);
    expect(rh.fallacies).toContain('red_herring');
    expect(rh.relevance).toBeLessThan(0.3);
    const hg = await judge.evaluate(arg('I met one dishonest official, so all of them are crooked.'), []);
    expect(hg.fallacies).toContain('hasty_generalization');
  });

  it('leaves a clean, structured argument unflagged', async () => {
    const v = await judge.evaluate(
      arg('The data shows lower recidivism; therefore the program reduces harm.'),
      [],
    );
    expect(v.fallacies).toEqual([]);
    expect(v.soundness).toBeGreaterThan(0.2);
  });
});
