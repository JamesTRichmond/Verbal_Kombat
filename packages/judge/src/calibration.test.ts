import { describe, expect, it } from 'vitest';
import { HeuristicJudge } from './judge.js';
import { EnsembleJudge } from './ensemble.js';
import { CALIBRATION_CASES, scoreJudge } from './calibration.js';

describe('calibration suite', () => {
  it('covers more than a handful of authored fixtures', () => {
    expect(CALIBRATION_CASES.length).toBeGreaterThanOrEqual(12);
  });

  it('HeuristicJudge recalls authored fallacies and stays in soundness bands', async () => {
    const report = await scoreJudge(new HeuristicJudge());
    expect(report.fallacyRecall).toBe(1);
    expect(report.bandHitRate).toBe(1);
    expect(report.cases.every((c) => c.fallacyHit)).toBe(true);
  });

  it('a singleton ensemble matches the same report', async () => {
    const report = await scoreJudge(new EnsembleJudge([new HeuristicJudge()]));
    expect(report.fallacyRecall).toBe(1);
    expect(report.bandHitRate).toBe(1);
  });
});
