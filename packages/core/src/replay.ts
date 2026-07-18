/**
 * The annotated transcript & replay format.
 *
 * Canon: "Every match generates an annotated transcript: every argument
 * scored, every fallacy named and timestamped... the transcript is the
 * ground truth and the replay is the index into it."
 */

import type { ArgumentEvent, CombatEvent, JudgeVerdict } from './events.js';
import type { MatchConfig, ProblemModeOutcome } from './match.js';
import type { Side } from './fighters.js';

/** One fully-annotated exchange: utterance ↔ verdict ↔ what it did on screen. */
export interface TranscriptEntry {
  argument: ArgumentEvent;
  verdict: JudgeVerdict;
  combat: CombatEvent[];
}

export interface MatchReplay {
  config: MatchConfig;
  entries: TranscriptEntry[];
  winner?: Side;
  finalIntegrity: Record<Side, number>;
  problemOutcome?: ProblemModeOutcome;
  /** Aggregate stats for progression + the RL harness. */
  stats: Record<
    Side,
    {
      arguments: number;
      cleanHits: number;
      fallacies: number;
      avgSoundness: number;
      totalDamageDealt: number;
    }
  >;
}

/**
 * Scrub index: given a time t in the fight, find the exchange that caused
 * the most recent visible event — "that combo at 1:42 resolves to the
 * three-sentence syllogism it was."
 */
export function entryAt(replay: MatchReplay, t: number): TranscriptEntry | undefined {
  let best: TranscriptEntry | undefined;
  for (const e of replay.entries) {
    if (e.argument.t <= t) best = e;
    else break;
  }
  return best;
}
