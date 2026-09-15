/**
 * Annotated calibration scripts — Phase 1 eval fixtures.
 *
 * Each case is a single utterance with authored expected fallacies and a
 * soundness band. Score a Judge against the library without calling a model.
 */

import type { ArgumentEvent, FallacyId } from '@vk/core';
import type { Judge } from './judge.js';

export interface CalibrationCase {
  id: string;
  text: string;
  expectedFallacies: FallacyId[];
  /** Inclusive band the judge's soundness should land in. */
  soundnessMin: number;
  soundnessMax: number;
}

export const CALIBRATION_CASES: CalibrationCase[] = [
  {
    id: 'clean-evidence',
    text: 'The data shows lower recidivism; therefore the program reduces harm.',
    expectedFallacies: [],
    soundnessMin: 0.3,
    soundnessMax: 1,
  },
  {
    id: 'no-true-scotsman',
    text: 'No true skeptic would ever accept that shoddy study.',
    expectedFallacies: ['no_true_scotsman'],
    soundnessMin: 0,
    soundnessMax: 0.35,
  },
  {
    id: 'appeal-to-ignorance',
    text: 'No one has proven me wrong, so my position stands.',
    expectedFallacies: ['appeal_to_ignorance'],
    soundnessMin: 0,
    soundnessMax: 0.35,
  },
  {
    id: 'false-cause',
    text: 'Ever since we changed the policy, crime fell, so the policy caused it.',
    expectedFallacies: ['false_cause'],
    soundnessMin: 0,
    soundnessMax: 0.35,
  },
  {
    id: 'ad-hominem',
    text: 'Only a fool would deny the premise after that reply.',
    expectedFallacies: ['ad_hominem'],
    soundnessMin: 0,
    soundnessMax: 0.35,
  },
  {
    id: 'slippery-slope',
    text: 'Approve this exception and the next thing you know the rule is gone.',
    expectedFallacies: ['slippery_slope'],
    soundnessMin: 0,
    soundnessMax: 0.35,
  },
];

export interface CaseScore {
  id: string;
  fallacyHit: boolean;
  soundnessInBand: boolean;
  predicted: FallacyId[];
  soundness: number;
}

export interface CalibrationReport {
  cases: CaseScore[];
  fallacyRecall: number;
  bandHitRate: number;
}

function argFrom(c: CalibrationCase): ArgumentEvent {
  return { id: c.id, matchId: 'calib', side: 'A', text: c.text, seq: 1, t: 0 };
}

export async function scoreJudge(judge: Judge): Promise<CalibrationReport> {
  const cases: CaseScore[] = [];
  let hits = 0;
  let needed = 0;
  let bandHits = 0;

  for (const c of CALIBRATION_CASES) {
    const v = await judge.evaluate(argFrom(c), []);
    const predicted = v.fallacies;
    const expected = new Set(c.expectedFallacies);
    needed += expected.size;
    for (const id of expected) {
      if (predicted.includes(id)) hits++;
    }
    const fallacyHit =
      expected.size === 0 ? predicted.length === 0 : c.expectedFallacies.every((id) => predicted.includes(id));
    const soundnessInBand = v.soundness >= c.soundnessMin && v.soundness <= c.soundnessMax;
    if (soundnessInBand) bandHits++;
    cases.push({
      id: c.id,
      fallacyHit,
      soundnessInBand,
      predicted,
      soundness: v.soundness,
    });
  }

  return {
    cases,
    fallacyRecall: needed === 0 ? 1 : hits / needed,
    bandHitRate: CALIBRATION_CASES.length === 0 ? 1 : bandHits / CALIBRATION_CASES.length,
  };
}
