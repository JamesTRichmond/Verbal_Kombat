/**
 * Fighters.
 *
 * Canon: "each fighter is not a cosmetic skin but an embodiment of a debate
 * style: its methodologies, intellect, temperament, and approach."
 *
 * An Archetype is the immutable style definition. A FighterProfile is a
 * user's living instance of an archetype: it accumulates experience, levels,
 * and gear (weapons = offensive techniques, armor = fallacy resistances).
 */

import type { FallacyId } from './fallacies.js';

export type Side = 'A' | 'B';

/** Traits shape how the AI debates AND how the fighter animates. 0..1 each. */
export interface StyleTraits {
  /** Preference for interrogative pressure (Socratic questioning). */
  interrogation: number;
  /** Preference for empirical evidence and citation. */
  empiricism: number;
  /** Preference for formal logical structure (syllogism, deduction). */
  formalism: number;
  /** Rhetorical flair — persuasive power, but raises fallacy risk. */
  rhetoric: number;
  /** Aggression — attack tempo; trades defense for pressure. */
  aggression: number;
  /** Patience — willingness to build long multi-premise structures. */
  patience: number;
}

export interface FighterArchetype {
  id: string;
  name: string;
  title: string;
  description: string;
  traits: StyleTraits;
  /** Base fallacy tendencies — which mistakes this style is prone to. */
  fallacyRisk: Partial<Record<FallacyId, number>>;
  /** Visual identity for the renderer. */
  palette: { primary: string; secondary: string };
}

/** Weapons are offensive argumentative techniques. */
export interface Weapon {
  id: string;
  name: string;
  description: string;
  /** Multiplier applied to damage of a matching attack class. */
  damageBonus: number;
  appliesTo: 'jab' | 'heavy' | 'rebuttal' | 'all';
}

/** Armor is resistance to specific classes of rhetorical pressure. */
export interface Armor {
  id: string;
  name: string;
  description: string;
  /** Damage reduction (0..1) against attacks tainted by these fallacies slipping past the judge. */
  resists: FallacyId[];
  reduction: number;
}

export interface FighterProfile {
  id: string;
  ownerId: string;
  archetypeId: string;
  name: string;
  level: number;
  xp: number;
  weapons: Weapon[];
  armor: Armor[];
  /** Match history summary used by progression + RL harness. */
  record: { wins: number; losses: number; fallaciesCommitted: number; matches: number };
}

export const XP_PER_LEVEL = 1000;

/** Level required before a fighter can face user-created opponents (Problem Mode). */
export const PROBLEM_MODE_UNLOCK_LEVEL = 5;

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

/** The starting roster. Each is a methodology wearing a body. */
export const ROSTER: FighterArchetype[] = [
  {
    id: 'socrates_prime',
    name: 'Socrates Prime',
    title: 'The Interrogator',
    description:
      'Corners opponents with questions until the contradiction snaps shut like a trap. Slow, heavy, inevitable.',
    traits: { interrogation: 0.95, empiricism: 0.4, formalism: 0.7, rhetoric: 0.3, aggression: 0.35, patience: 0.9 },
    fallacyRisk: { begging_the_question: 0.1 },
    palette: { primary: '#c9a227', secondary: '#3d3424' },
  },
  {
    id: 'the_empiricist',
    name: 'The Empiricist',
    title: 'Weight of Evidence',
    description:
      'Buries the other side under data. Special moves require charging up with citations before they land.',
    traits: { interrogation: 0.3, empiricism: 0.95, formalism: 0.6, rhetoric: 0.2, aggression: 0.5, patience: 0.7 },
    fallacyRisk: { hasty_generalization: 0.12, appeal_to_authority: 0.15 },
    palette: { primary: '#2e86ab', secondary: '#12242e' },
  },
  {
    id: 'silver_tongue',
    name: 'Silver Tongue',
    title: 'The Rhetorician',
    description:
      'Fights beautiful and a little dirty — always one step from a fallacy that will cost it. Fast jabs, low stamina.',
    traits: { interrogation: 0.2, empiricism: 0.25, formalism: 0.3, rhetoric: 0.95, aggression: 0.8, patience: 0.25 },
    fallacyRisk: { appeal_to_emotion: 0.25, ad_hominem: 0.15, red_herring: 0.18, strawman: 0.15 },
    palette: { primary: '#a4243b', secondary: '#2b0d13' },
  },
  {
    id: 'the_formalist',
    name: 'The Formalist',
    title: 'Proof or Nothing',
    description:
      'Deductive lockdown. Every attack is a valid syllogism; every defense demands the opponent show their premises.',
    traits: { interrogation: 0.5, empiricism: 0.5, formalism: 0.95, rhetoric: 0.1, aggression: 0.4, patience: 0.85 },
    fallacyRisk: { equivocation: 0.05 },
    palette: { primary: '#6b9080', secondary: '#1c2621' },
  },
];
