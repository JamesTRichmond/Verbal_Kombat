/**
 * EnsembleJudge — Phase 1 calibration seam.
 *
 * Runs N judges on the same utterance and merges verdicts:
 *   - numeric scores: mean, clamped to [0, 1]
 *   - fallacies: majority vote (more than half of the panel)
 *   - rebuttal direction: strict panel majority, otherwise unclear
 *   - rationale: short summary of the vote
 *
 * Pair with ScriptAwareJudge / annotated fixtures when scoring a candidate.
 */

import type {
  ArgumentEvent,
  FallacyId,
  JudgeVerdict,
  RebuttalDirection,
  RebuttalTarget,
} from '@vk/core';
import type { Judge } from './judge.js';

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function normalizeOutcomeKey(text: string): string {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ');
}

function mergeRebuttalTargets(verdicts: JudgeVerdict[], threshold: number): RebuttalTarget[] | undefined {
  if (!verdicts.some((v) => Array.isArray(v.rebuttalTargets))) return undefined;
  const mentions = new Map<string, { outcome: string; count: number; directions: Map<RebuttalDirection, number> }>();
  for (const verdict of verdicts) {
    const perJudge = new Map<string, RebuttalTarget>();
    for (const target of verdict.rebuttalTargets ?? []) {
      const key = normalizeOutcomeKey(target.outcome);
      if (!key) continue;
      const previous = perJudge.get(key);
      perJudge.set(
        key,
        previous && previous.direction !== target.direction
          ? { outcome: previous.outcome, direction: 'unclear' }
          : { outcome: previous?.outcome ?? target.outcome, direction: target.direction },
      );
    }
    for (const [key, target] of perJudge) {
      const entry = mentions.get(key) ?? { outcome: target.outcome, count: 0, directions: new Map<RebuttalDirection, number>() };
      entry.count++;
      entry.directions.set(target.direction, (entry.directions.get(target.direction) ?? 0) + 1);
      mentions.set(key, entry);
    }
  }
  return [...mentions.values()]
    .filter((entry) => entry.count > threshold)
    .map((entry) => ({
      outcome: entry.outcome,
      direction:
        (['supports', 'challenges', 'unclear'] as const)
          .find((direction) => (entry.directions.get(direction) ?? 0) > threshold)
        ?? 'unclear',
    }))
    .sort((a, b) => a.outcome.localeCompare(b.outcome));
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
      rebuttalDirection: 'unclear',
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
  const rebuttalDirection = (['supports', 'challenges'] as const)
    .find((direction) => verdicts.filter((v) => v.rebuttalDirection === direction).length > threshold)
    ?? 'unclear';
  const rebuttalTargets = mergeRebuttalTargets(verdicts, threshold);

  return {
    argumentId,
    side,
    soundness: clamp01(mean(verdicts.map((v) => v.soundness))),
    relevance: clamp01(mean(verdicts.map((v) => v.relevance))),
    evidence: clamp01(mean(verdicts.map((v) => v.evidence))),
    structure: clamp01(mean(verdicts.map((v) => v.structure))),
    fallacies,
    rebuttalForce: clamp01(mean(verdicts.map((v) => v.rebuttalForce))),
    rebuttalDirection,
    ...(rebuttalTargets !== undefined ? { rebuttalTargets } : {}),
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
