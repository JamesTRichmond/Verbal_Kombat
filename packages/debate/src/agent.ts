/**
 * The DebateAgent abstraction.
 *
 * Canon v1: "only the AI controls the fighters." A DebateAgent is the mind
 * inside a fighter — given the topic, its stance, its archetype's style
 * traits, and the debate so far, it produces the next utterance.
 *
 * Two implementations ship in the foundation:
 *  - ScriptedAgent: replays authored debates (deterministic; drives the demo
 *    and all tests).
 *  - LlmAgent: provider-agnostic adapter for real model-driven debate
 *    (the production path; requires an ApiClient binding).
 */

import type { ArgumentEvent, FighterArchetype, Side } from '@vk/core';

export interface DebateContext {
  matchId: string;
  topic: string;
  stance: string;
  side: Side;
  /** Present when the caller carries archetypes (LlmAgent requires it). */
  archetype?: FighterArchetype;
  /** Full debate so far, both sides, in order. */
  history: ArgumentEvent[];
}

export interface DebateAgent {
  readonly kind: string;
  /**
   * Produce the next utterance, or null when the agent rests its case.
   * Implementations must be side-effect free w.r.t. game state.
   */
  nextArgument(ctx: DebateContext): Promise<string | null>;
}
