/**
 * ScriptAwareJudge — verdicts from authored ground truth.
 *
 * When a match is driven by a DebateScript, the script's annotations ARE
 * the correct verdicts. This makes the demo deterministic and gives us a
 * golden oracle: run any candidate judge over the same script and diff its
 * verdicts against this one.
 */

import type { ArgumentEvent, FallacyId, JudgeVerdict } from '@vk/core';
import { annotationsFor, type DebateScript } from '@vk/debate';
import type { Judge } from './judge.js';

export class ScriptAwareJudge implements Judge {
  readonly kind = 'script';

  constructor(private readonly script: DebateScript) {}

  async evaluate(arg: ArgumentEvent, _history: ArgumentEvent[]): Promise<JudgeVerdict> {
    const ann = annotationsFor(this.script, arg.text);
    const fallacies = (ann?.fallacies ?? []) as FallacyId[];
    const soundness = ann?.soundness ?? 0.6;

    return {
      argumentId: arg.id,
      side: arg.side,
      soundness,
      relevance: fallacies.includes('red_herring') ? 0.2 : 0.85,
      evidence: ann?.evidence ?? 0.4,
      structure: soundness,
      fallacies,
      rebuttalForce: ann?.rebuts && fallacies.length === 0 ? Math.min(1, soundness + 0.1) : 0,
      rationale:
        fallacies.length > 0
          ? `Authored ground truth: ${fallacies.join(', ')}.`
          : 'Authored ground truth: clean.',
    };
  }
}
