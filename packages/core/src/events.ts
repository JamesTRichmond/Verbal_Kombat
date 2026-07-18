/**
 * The event pipeline — the spine of the whole system.
 *
 *   DebateEngine ──ArgumentEvent──▶ Judge ──JudgeVerdict──▶ CombatMapper
 *        ──CombatEvent[]──▶ Renderer / ReplayRecorder / RL harness
 *
 * Canon: "the fight on screen is a live, legible depiction of the debate
 * itself — its momentum, its structure, its turning points."
 */

import type { FallacyId } from './fallacies.js';
import type { Side } from './fighters.js';

/** One utterance by one debater. Produced by the DebateEngine. */
export interface ArgumentEvent {
  id: string;
  matchId: string;
  side: Side;
  /** The full text of the utterance. Ground truth for the transcript. */
  text: string;
  /** Monotonic sequence number within the match. */
  seq: number;
  /** Milliseconds since match start (debate-time, not wall-clock). */
  t: number;
  /** If this utterance directly rebuts a prior argument, its id. */
  rebuts?: string;
}

/** The judge's structured evaluation of a single ArgumentEvent. */
export interface JudgeVerdict {
  argumentId: string;
  side: Side;
  /** 0..1 — do the premises support the conclusion? */
  soundness: number;
  /** 0..1 — does it engage the actual topic and the opponent's actual claims? */
  relevance: number;
  /** 0..1 — is it backed by evidence rather than assertion? */
  evidence: number;
  /** 0..1 — structural quality: premises, warrant, conclusion. */
  structure: number;
  /** Fallacies the judge caught in this utterance. Empty = clean. */
  fallacies: FallacyId[];
  /** If this successfully dismantles a prior argument, how decisively (0..1). */
  rebuttalForce: number;
  /** One-line explanation, shown in the annotated transcript. */
  rationale: string;
}

export type CombatEventType =
  | 'jab'            // short clean factual point
  | 'heavy'          // multi-premise constructed argument
  | 'combo_hit'      // point that genuinely builds on the previous one
  | 'launcher'       // devastating rebuttal — knockdown
  | 'whiff'          // fallacy: swings at empty air
  | 'labeled_block'  // fallacy: defender blocks, fallacy name flashes
  | 'backfire'       // fallacy: attacker stumbles, chip damage to self
  | 'guard'          // defensive posture (low-quality but clean utterance)
  | 'finisher';      // the closing argument — fatality if it lands

export interface CombatEvent {
  id: string;
  matchId: string;
  type: CombatEventType;
  /** Whose fighter performs the visible action. */
  actor: Side;
  /** Damage dealt to the opponent's position integrity (>= 0). */
  damage: number;
  /** Damage dealt to the actor itself (backfires). */
  selfDamage: number;
  /** Label flashed on screen, e.g. "STRAWMAN — BLOCKED" or "COMBO x3". */
  label?: string;
  /** Combo depth at the moment of the hit (1 = not a combo). */
  combo: number;
  /** The argument that caused this event — the index back into the transcript. */
  sourceArgumentId: string;
  t: number;
}
