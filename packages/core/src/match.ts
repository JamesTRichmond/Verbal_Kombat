/**
 * Match state.
 *
 * Canon: "The health bar isn't health. It's the structural integrity of your
 * position, and it only breaks when someone breaks your reasoning."
 */

import type { Side } from './fighters.js';

export const MAX_INTEGRITY = 100;

export type MatchPhase = 'setup' | 'debating' | 'finish_him' | 'complete';

export type ProblemModeOutcome = {
  /** Canon victory condition: the fight is won when it has produced sound
   *  logical reasoning on how to proceed with or interpret the issue. */
  reasoningSummary: string;
  recommendation: string;
  keyArgumentIds: string[];
};

export interface MatchConfig {
  id: string;
  /** The arena IS the topic. */
  topic: string;
  /** Stance assigned by the user to each side. */
  stances: Record<Side, string>;
  /** Archetype id per side. */
  fighters: Record<Side, string>;
  mode: 'exhibition' | 'ranked' | 'problem';
  /** In problem mode, the user's described problem (side B is built from it). */
  problemStatement?: string;
}

export interface SideState {
  /** Position integrity 0..MAX_INTEGRITY. */
  integrity: number;
  /** Momentum -1..1 (positive = pressing the advantage). */
  momentum: number;
  /** Current combo depth. */
  combo: number;
  /** Set after a backfire: visibly vulnerable; the next clean hit against
   *  this side is a punish (bonus damage) and clears the stagger. */
  staggered: boolean;
  fallaciesCommitted: number;
  cleanHits: number;
}

export interface MatchState {
  config: MatchConfig;
  phase: MatchPhase;
  sides: Record<Side, SideState>;
  winner?: Side;
  /** Set when a problem-mode match resolves. */
  problemOutcome?: ProblemModeOutcome;
  /** Debate-time clock in ms. */
  clock: number;
}

export function newSideState(): SideState {
  return { integrity: MAX_INTEGRITY, momentum: 0, combo: 0, staggered: false, fallaciesCommitted: 0, cleanHits: 0 };
}

export function newMatch(config: MatchConfig): MatchState {
  return {
    config,
    phase: 'debating',
    sides: { A: newSideState(), B: newSideState() },
    clock: 0,
  };
}

export function opponent(side: Side): Side {
  return side === 'A' ? 'B' : 'A';
}
