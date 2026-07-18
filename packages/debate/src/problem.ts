/**
 * Problem Mode — the killer application.
 *
 * Canon: "they describe the problem they are encountering. The program
 * creates a 'fighter' out of that problem. The user's own trained fighter
 * then goes at it... until the fight has produced sound logical reasoning
 * on how to proceed."
 *
 * synthesizeProblemFighter turns a described problem into an opposing
 * archetype + stance. The victory condition is NOT integrity depletion for
 * its own sake — resolveProblemOutcome extracts the reasoned conclusion
 * from the match replay, and the match only counts as won when that
 * conclusion exists and is sound.
 */

import type { FighterArchetype, MatchReplay, ProblemModeOutcome } from '@vk/core';
import { PROBLEM_MODE_UNLOCK_LEVEL } from '@vk/core';

export interface ProblemStatement {
  /** The user's own words describing what they're stuck on. */
  description: string;
  /** What a resolution needs to decide or interpret. */
  question: string;
}

export function canEnterProblemMode(level: number): boolean {
  return level >= PROBLEM_MODE_UNLOCK_LEVEL;
}

/**
 * Build the opponent: the problem itself, given a body and a stance.
 * The problem-fighter argues FOR the tangle — for every reason the issue is
 * hard, every objection, every fear, every constraint. Beating it soundly
 * means the user's fighter has actually answered them.
 */
export function synthesizeProblemFighter(problem: ProblemStatement): {
  archetype: FighterArchetype;
  stance: string;
} {
  return {
    archetype: {
      id: 'problem_embodied',
      name: 'The Tangle',
      title: 'Your Problem, Given Form',
      description: `An adversary synthesized from: "${problem.description}". It argues every objection, constraint, and fear inside the problem — and it falls only to sound reasoning.`,
      traits: { interrogation: 0.7, empiricism: 0.6, formalism: 0.6, rhetoric: 0.5, aggression: 0.6, patience: 0.7 },
      fallacyRisk: { appeal_to_emotion: 0.2, slippery_slope: 0.2, false_dilemma: 0.15 },
      palette: { primary: '#5a5766', secondary: '#17151c' },
    },
    stance: `This problem cannot be cleanly resolved: ${problem.question}`,
  };
}

/**
 * Extract the reasoned conclusion from a finished problem-mode match.
 * Foundation implementation: selects the user's side's strongest exchanges
 * as the skeleton of the reasoning. The production version hands the replay
 * to a synthesis model. Returns null if the fight has not yet produced
 * sound reasoning (canon: that means the fight is not over).
 */
export function resolveProblemOutcome(replay: MatchReplay, userSide: 'A' | 'B'): ProblemModeOutcome | null {
  if (replay.winner !== userSide) return null;

  const strong = replay.entries
    .filter((e) => e.argument.side === userSide && e.verdict.fallacies.length === 0)
    .sort((a, b) => b.verdict.soundness + b.verdict.rebuttalForce - (a.verdict.soundness + a.verdict.rebuttalForce))
    .slice(0, 3);

  if (strong.length === 0) return null;

  return {
    reasoningSummary: strong.map((e) => e.argument.text).join(' '),
    recommendation:
      'Proceed along the line of reasoning above — it survived every objection the problem could raise.',
    keyArgumentIds: strong.map((e) => e.argument.id),
  };
}
