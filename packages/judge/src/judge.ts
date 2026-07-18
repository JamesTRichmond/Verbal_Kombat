/**
 * The Judge — "a judge that never sleeps and never gets tired."
 *
 * Evaluates every utterance: soundness, relevance, evidence, structure,
 * fallacies, rebuttal force. The judge is THE source of truth the combat
 * mapper consumes, and its verdicts are the punishment/reward signal for
 * the RL loop — which makes judge quality the single most important
 * correctness property in the system.
 *
 * Implementations:
 *  - ScriptAwareJudge: reads authored ground-truth annotations from a
 *    DebateScript (drives the demo deterministically; doubles as the
 *    golden-file oracle when testing real judges).
 *  - HeuristicJudge: dependency-free lexical heuristics — a floor, not a
 *    ceiling. The production judge is an LLM (or ensemble) behind this
 *    same interface.
 */

import type { ArgumentEvent, FallacyId, JudgeVerdict } from '@vk/core';

export interface Judge {
  readonly kind: string;
  evaluate(arg: ArgumentEvent, history: ArgumentEvent[]): Promise<JudgeVerdict>;
}

/* ------------------------------------------------------------------ */
/* HeuristicJudge                                                      */
/* ------------------------------------------------------------------ */

const FALLACY_MARKERS: Partial<Record<FallacyId, RegExp[]>> = {
  ad_hominem: [/\b(fool|idiot|coward|liar|stupid)\b/i, /people who (deny|believe|say) .* are (simply|just|merely)/i],
  strawman: [/so you (claim|are saying|admit) we/i, /that is your position'?s true face/i],
  appeal_to_authority: [/\beveryone from .* to .* has\b/i, /\bthe experts? (all )?agree\b/i],
  appeal_to_popularity: [/\b(educated )?consensus is settled\b/i, /\beverybody (knows|believes)\b/i],
  appeal_to_emotion: [/\bimagine the (horror|suffering|tears)\b/i, /\bhow would you feel\b/i],
  slippery_slope: [/\bnext thing you know\b/i, /\binevitably lead to\b/i],
  false_dilemma: [/\beither .* or .*, there is no\b/i, /\bthe only two (options|choices)\b/i],
};

const EVIDENCE_MARKERS = [
  /\b(experiment|study|studies|data|measured|model|evidence|documented|research)\b/i,
  /\b(shows?|demonstrates?|found)\b/i,
];

const STRUCTURE_MARKERS = [
  /\b(therefore|thus|it follows|because|since|premise|conclusion)\b/i,
  /\bwhen .*, (then )?/i,
];

const REBUTTAL_MARKERS = [
  /\b(but|yet|however|note what just happened|you claim|your (argument|position|premise))\b/i,
  /\b(cuts against you|untouched|no such thing|is not)\b/i,
];

function scoreAgainst(text: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const p of patterns) if (p.test(text)) hits++;
  return Math.min(1, hits / 2);
}

export class HeuristicJudge implements Judge {
  readonly kind = 'heuristic';

  async evaluate(arg: ArgumentEvent, history: ArgumentEvent[]): Promise<JudgeVerdict> {
    const fallacies: FallacyId[] = [];
    for (const [id, patterns] of Object.entries(FALLACY_MARKERS) as [FallacyId, RegExp[]][]) {
      if (patterns.some((p) => p.test(arg.text))) fallacies.push(id);
    }

    const evidence = scoreAgainst(arg.text, EVIDENCE_MARKERS);
    const structure = scoreAgainst(arg.text, STRUCTURE_MARKERS);
    const lastOpposing = [...history].reverse().find((h) => h.side !== arg.side);
    const engagesOpponent = lastOpposing ? scoreAgainst(arg.text, REBUTTAL_MARKERS) : 0;

    // Fallacies gut soundness; otherwise soundness tracks structure + length discipline.
    const lengthDiscipline = arg.text.length > 40 && arg.text.length < 600 ? 0.3 : 0.1;
    const soundness = fallacies.length > 0 ? 0.2 : Math.min(1, 0.35 + structure * 0.35 + lengthDiscipline);

    return {
      argumentId: arg.id,
      side: arg.side,
      soundness,
      relevance: fallacies.includes('red_herring') ? 0.2 : 0.7,
      evidence,
      structure,
      fallacies,
      rebuttalForce: fallacies.length > 0 ? 0 : engagesOpponent * 0.8,
      rationale:
        fallacies.length > 0
          ? `Fallacies detected: ${fallacies.join(', ')}.`
          : `Clean argument. structure=${structure.toFixed(2)}, evidence=${evidence.toFixed(2)}.`,
    };
  }
}
