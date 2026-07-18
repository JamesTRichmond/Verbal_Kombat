/**
 * Progression — XP, and the RL bridge.
 *
 * Canon: "every match is a training episode, every fallacy punished is a
 * gradient signal, and the game loop and the improvement loop are the same
 * loop."
 *
 * xpForMatch and rewardSignal are intentionally two views of one event:
 * xp feeds the player-facing progression; rewardSignal feeds the
 * self-play training harness. They must stay aligned — improving the
 * fighter the player sees IS improving the model underneath.
 */

import type { MatchReplay } from './replay.js';
import type { Side } from './fighters.js';

export interface XpAward {
  total: number;
  breakdown: { reason: string; amount: number }[];
}

export function xpForMatch(replay: MatchReplay, side: Side): XpAward {
  const s = replay.stats[side];
  const breakdown: { reason: string; amount: number }[] = [];

  breakdown.push({ reason: 'participation', amount: 50 });
  breakdown.push({ reason: 'clean hits landed', amount: s.cleanHits * 15 });
  breakdown.push({ reason: 'argument soundness', amount: Math.round(s.avgSoundness * 100) });
  if (replay.winner === side) breakdown.push({ reason: 'victory', amount: 150 });
  // Fallacies cost you. Getting better means committing fewer.
  breakdown.push({ reason: 'fallacies committed', amount: -s.fallacies * 20 });

  const total = Math.max(0, breakdown.reduce((sum, b) => sum + b.amount, 0));
  return { total, breakdown };
}

/**
 * Scalar reward for the self-play RL harness, normalized to roughly -1..1.
 * Positive for winning with sound, clean argumentation; negative for
 * fallacy-riddled play even in victory.
 */
export function rewardSignal(replay: MatchReplay, side: Side): number {
  const s = replay.stats[side];
  const winTerm = replay.winner === side ? 0.5 : replay.winner ? -0.5 : 0;
  const soundnessTerm = (s.avgSoundness - 0.5) * 0.6;
  const fallacyTerm = -Math.min(0.4, s.fallacies * 0.08);
  return Math.max(-1, Math.min(1, winTerm + soundnessTerm + fallacyTerm));
}
