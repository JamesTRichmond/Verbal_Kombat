/**
 * EnsembleJudge — Phase 1 calibration seam.
 *
 * Runs N judges on the same utterance and merges verdicts:
 *   - numeric scores: mean, clamped to [0, 1]
 *   - fallacies: majority vote (more than half of the panel)
 *   - rationale: short summary of the vote
 *
 * Pair with ScriptAwareJudge / annotated fixtures when scoring a candidate.
 */

import type { ArgumentEvent, FallacyId, JudgeVerdict } from '@vk/core';
import type { Judge } from './judge.js';

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function mergeVerdicts(
  argumentId: string,
  side: JudgeVerdict['side'],
  verdicts: JudgeVerdict[],
): JudgeVerdict {
  if (verdicts.length === 0) {
    return {
      argumentId,
      side,
      soundness: 0,
      relevance: 0,
      evidence: 0,
      structure: 0,
      fallacies: [],
      rebuttalForce: 0,
      rationale: 'Empty ensemble.',
    };
  }

  const counts = new Map<FallacyId, number>();
  for (const v of verdicts) {
    for (const id of v.fallacies) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const threshold = verdicts.length / 2;
  const fallacies = [...counts.entries()]
    .filter(([, n]) => n > threshold)
    .map(([id]) => id)
    .sort();

  return {
    argumentId,
    side,
    soundness: clamp01(mean(verdicts.map((v) => v.soundness))),
    relevance: clamp01(mean(verdicts.map((v) => v.relevance))),
    evidence: clamp01(mean(verdicts.map((v) => v.evidence))),
    structure: clamp01(mean(verdicts.map((v) => v.structure))),
    fallacies,
    rebuttalForce: clamp01(mean(verdicts.map((v) => v.rebuttalForce))),
    rationale:
      fallacies.length > 0
        ? `Ensemble majority: ${fallacies.join(', ')} (${verdicts.length} judges).`
        : `Ensemble clean (${verdicts.length} judges).`,
  };
}

export class EnsembleJudge implements Judge {
  readonly kind = 'ensemble';

  constructor(private readonly panel: readonly Judge[]) {
    if (panel.length === 0) throw new Error('EnsembleJudge requires at least one judge');
  }

  async evaluate(arg: ArgumentEvent, history: ArgumentEvent[]): Promise<JudgeVerdict> {
    const verdicts = await Promise.all(this.panel.map((j) => j.evaluate(arg, history)));
    return mergeVerdicts(arg.id, arg.side, verdicts);
  }
}
