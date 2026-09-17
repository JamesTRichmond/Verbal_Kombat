import { describe, expect, it } from 'vitest';
import type { ArgumentEvent, JudgeVerdict } from '@vk/core';
import { HeuristicJudge } from './judge.js';
import { EnsembleJudge, mergeVerdicts } from './ensemble.js';
import type { Judge } from './judge.js';

function arg(text: string): ArgumentEvent {
  return { id: 'a1', matchId: 'm1', side: 'A', text, seq: 1, t: 1000 };
}

function stub(kind: string, verdict: Partial<JudgeVerdict>): Judge {
  return {
    kind,
    async evaluate(a) {
      return {
        argumentId: a.id,
        side: a.side,
        soundness: 0.5,
        relevance: 0.5,
        evidence: 0.5,
        structure: 0.5,
        fallacies: [],
        rebuttalForce: 0,
        rationale: kind,
        ...verdict,
      };
    },
  };
}

describe('mergeVerdicts', () => {
  it('returns unclear for an empty panel', () => {
    expect(mergeVerdicts('a1', 'A', []).rebuttalDirection).toBe('unclear');
  });

  it.each<{
    directions: JudgeVerdict['rebuttalDirection'][];
    expected: JudgeVerdict['rebuttalDirection'];
  }>([
    { directions: ['supports'], expected: 'supports' },
    { directions: ['challenges'], expected: 'challenges' },
    { directions: ['supports', 'supports', 'challenges'], expected: 'supports' },
    { directions: ['challenges', 'challenges', 'supports'], expected: 'challenges' },
    { directions: ['supports', 'supports', undefined], expected: 'supports' },
    { directions: ['challenges', 'challenges', 'unclear'], expected: 'challenges' },
    { directions: ['supports', 'challenges'], expected: 'unclear' },
    { directions: ['supports', 'unclear'], expected: 'unclear' },
    { directions: ['challenges', undefined], expected: 'unclear' },
    { directions: ['supports', 'unclear', undefined], expected: 'unclear' },
    { directions: [undefined, undefined], expected: 'unclear' },
    { directions: ['unclear', 'unclear'], expected: 'unclear' },
  ])('requires a full-panel majority: $directions -> $expected', async ({ directions, expected }) => {
    const utterance = arg('There is no way to prevent the fine risk.');
    const verdicts = await Promise.all(directions.map((direction) => stub('judge', {
      rebuttalForce: 0.8,
      ...(direction === undefined ? {} : { rebuttalDirection: direction }),
    }).evaluate(utterance, [])));
    expect(mergeVerdicts(utterance.id, utterance.side, verdicts).rebuttalDirection).toBe(expected);
  });

  it('averages scores and majority-votes fallacies', () => {
    const a: JudgeVerdict = {
      argumentId: 'a1',
      side: 'A',
      soundness: 0.2,
      relevance: 0.4,
      evidence: 0.0,
      structure: 0.2,
      fallacies: ['ad_hominem', 'strawman'],
      rebuttalForce: 0,
      rationale: 'a',
    };
    const b: JudgeVerdict = {
      argumentId: 'a1',
      side: 'A',
      soundness: 0.4,
      relevance: 0.6,
      evidence: 0.2,
      structure: 0.4,
      fallacies: ['ad_hominem'],
      rebuttalForce: 0.2,
      rationale: 'b',
    };
    const merged = mergeVerdicts('a1', 'A', [a, b]);
    expect(merged.soundness).toBeCloseTo(0.3);
    expect(merged.relevance).toBeCloseTo(0.5);
    expect(merged.fallacies).toEqual(['ad_hominem']);
    expect(merged.fallacies).not.toContain('strawman');
  });
});

describe('EnsembleJudge', () => {
  it('requires a non-empty panel', () => {
    expect(() => new EnsembleJudge([])).toThrow(/at least one/);
  });

  it('agrees with HeuristicJudge when the panel is only that judge', async () => {
    const h = new HeuristicJudge();
    const ens = new EnsembleJudge([h]);
    const utterance = arg('No true skeptic would ever accept that shoddy study.');
    const [left, right] = await Promise.all([h.evaluate(utterance, []), ens.evaluate(utterance, [])]);
    expect(right.fallacies).toEqual(left.fallacies);
    expect(right.soundness).toBeCloseTo(left.soundness);
  });

  it('drops a minority fallacy call', async () => {
    const panel = new EnsembleJudge([
      stub('yes', { fallacies: ['slippery_slope'] }),
      stub('no-a', { fallacies: [] }),
      stub('no-b', { fallacies: [] }),
    ]);
    const v = await panel.evaluate(arg('Anything at all.'), []);
    expect(v.fallacies).toEqual([]);
  });

  it('preserves consensus direction through evaluation', async () => {
    const panel = new EnsembleJudge([
      stub('a', { rebuttalDirection: 'supports' }),
      stub('b', { rebuttalDirection: 'supports' }),
      stub('c', { rebuttalDirection: 'challenges' }),
    ]);
    const v = await panel.evaluate(arg('There is no way to prevent the fine risk.'), []);
    expect(v.rebuttalDirection).toBe('supports');
  });
});
