/**
 * ScriptedAgent — deterministic authored debates.
 *
 * Scripts let us build and test the entire pipeline (judge → combat →
 * renderer → replay) without an LLM in the loop, and they double as
 * golden-file fixtures for the judge.
 */

import type { DebateAgent, DebateContext } from './agent.js';

export interface ScriptLine {
  side: 'A' | 'B';
  text: string;
  /**
   * Author-declared ground truth for testing the judge against, and for
   * driving the heuristic judge in the demo. Optional; the production
   * judge must detect these unaided.
   */
  annotations?: {
    fallacies?: string[];
    soundness?: number;
    evidence?: number;
    rebuts?: boolean;
    isCloser?: boolean;
  };
}

export interface DebateScript {
  topic: string;
  stances: { A: string; B: string };
  lines: ScriptLine[];
}

export class ScriptedAgent implements DebateAgent {
  readonly kind = 'scripted';
  private cursor = 0;

  constructor(
    private readonly script: DebateScript,
    private readonly side: 'A' | 'B',
  ) {}

  async nextArgument(_ctx: DebateContext): Promise<string | null> {
    while (this.cursor < this.script.lines.length) {
      const line = this.script.lines[this.cursor];
      if (!line) return null;
      if (line.side === this.side) {
        this.cursor++;
        return line.text;
      }
      this.cursor++;
    }
    return null;
  }
}

/** Look up a script line's annotations by its text (used by the demo judge). */
export function annotationsFor(script: DebateScript, text: string): ScriptLine['annotations'] | undefined {
  return script.lines.find((l) => l.text === text)?.annotations;
}
