/**
 * Council Mode — the Swarm of Geniuses as a tournament.
 *
 * The user brings a problem. A council of geniuses is seated. Each seat
 * proposes an answer, and each answer names its possible outcomes with
 * (probability × how much that outcome matters to the owner).
 *
 * The seats then fight. The fights are not decoration: a position that gets
 * broken in debate loses CREDIBILITY, and credibility discounts the claims
 * that position made about its own odds and stakes. The crown goes to the
 * proposal with the highest calibrated expected value — not simply the last
 * fighter standing.
 *
 *   EV(proposal) = Σ_k  p'_k × m'_k
 *   p'_k = c·p_k + (1−c)·skepticalPrior       (broken positions regress toward doubt)
 *   m'_k = c·m_k                              (broken positions can't vouch for their stakes)
 *   c    = credibility earned in the fights (0..1)
 */

import type { MatchReplay } from './replay.js';
import type { Side } from './fighters.js';
import { GENIUSES, WING_ORDER, getGenius, type Genius, type WingId } from './geniuses.js';

/* ------------------------------------------------------------------ */
/* What matters to the owner                                           */
/* ------------------------------------------------------------------ */

export interface ValueCriterion {
  id: string;
  label: string;
  /** Relative weight; profiles are normalized before use. */
  weight: number;
}

/** The owner's value system. "How much it matters" is scored against this. */
export interface ValueProfile {
  ownerId: string;
  ownerName: string;
  criteria: ValueCriterion[];
}

/**
 * Draft profile for the account owner. The criteria and weights are a
 * starting point for James to edit in the setup flow — not a claim about
 * what he values.
 */
export const OWNER_DRAFT_PROFILE: ValueProfile = {
  ownerId: 'owner',
  ownerName: 'James',
  criteria: [
    { id: 'career', label: 'Moves the pivot into applied AI work forward', weight: 3 },
    { id: 'income', label: 'Income and stability', weight: 3 },
    { id: 'energy', label: 'Time and energy cost is sustainable', weight: 2 },
    { id: 'craft', label: 'Creative and intellectual fulfillment', weight: 2 },
    { id: 'people', label: 'Good for the people he cares about', weight: 2 },
  ],
};

export function normalizeProfile(profile: ValueProfile): ValueProfile {
  const total = profile.criteria.reduce((s, c) => s + Math.max(0, c.weight), 0);
  if (total <= 0) throw new Error('ValueProfile needs at least one positive weight');
  return {
    ...profile,
    criteria: profile.criteria.map((c) => ({ ...c, weight: Math.max(0, c.weight) / total })),
  };
}

/**
 * How much an outcome matters: weighted sum of per-criterion impact.
 * Impacts are -1..1 (negative = the outcome hurts that criterion), so the
 * result is -1..1.
 */
export function mattersScore(profile: ValueProfile, impacts: Record<string, number>): number {
  const p = normalizeProfile(profile);
  const raw = p.criteria.reduce((s, c) => s + c.weight * clamp(impacts[c.id] ?? 0, -1, 1), 0);
  return clamp(raw, -1, 1);
}

/* ------------------------------------------------------------------ */
/* Proposals                                                           */
/* ------------------------------------------------------------------ */

export interface ProposalOutcome {
  description: string;
  /** 0..1 — the seat's claimed chance this outcome happens. */
  probability: number;
  /** Per-criterion impact, -1..1, keyed by ValueCriterion.id. */
  impacts: Record<string, number>;
}

export interface Proposal {
  seat: string; // genius slug
  /** The answer in one or two lines — also the fighter's stance. */
  answer: string;
  /** The move the genius applied to get there. */
  reasoning: string;
  outcomes: ProposalOutcome[];
}

export interface ScoredOutcome extends ProposalOutcome {
  matters: number;
  calibratedProbability: number;
  calibratedMatters: number;
}

export interface ProposalScore {
  seat: string;
  claimedEV: number;
  credibility: number;
  calibratedEV: number;
  outcomes: ScoredOutcome[];
}

export const SKEPTICAL_PRIOR = 0.2;

/** Σ p × m — the owner-weighted expected value the proposal claims for itself. */
export function claimedExpectedValue(proposal: Proposal, profile: ValueProfile): number {
  return proposal.outcomes.reduce(
    (s, o) => s + clamp(o.probability, 0, 1) * mattersScore(profile, o.impacts),
    0,
  );
}

export function scoreProposal(
  proposal: Proposal,
  profile: ValueProfile,
  credibility: number,
  skepticalPrior = SKEPTICAL_PRIOR,
): ProposalScore {
  const c = clamp(credibility, 0, 1);
  const outcomes: ScoredOutcome[] = proposal.outcomes.map((o) => {
    const p = clamp(o.probability, 0, 1);
    const m = mattersScore(profile, o.impacts);
    return {
      ...o,
      matters: m,
      calibratedProbability: c * p + (1 - c) * skepticalPrior,
      calibratedMatters: c * m,
    };
  });
  return {
    seat: proposal.seat,
    claimedEV: claimedExpectedValue(proposal, profile),
    credibility: c,
    calibratedEV: outcomes.reduce((s, o) => s + o.calibratedProbability * o.calibratedMatters, 0),
    outcomes,
  };
}

/* ------------------------------------------------------------------ */
/* Credibility — what the fights prove                                 */
/* ------------------------------------------------------------------ */

/** One seat's appearance in one bout. */
export interface BoutRecord {
  seat: string;
  replay: MatchReplay;
  side: Side;
}

/**
 * Credibility = how intact the position stayed under attack, minus a
 * penalty for fallacies, plus a small bonus for winning the bout.
 * A seat with no bouts keeps neutral credibility (0.5).
 */
export function credibilityFrom(bouts: BoutRecord[]): number {
  if (bouts.length === 0) return 0.5;
  const per = bouts.map(({ replay, side }) => {
    const integrity = (replay.finalIntegrity[side] ?? 0) / 100;
    const fallacies = replay.stats[side]?.fallacies ?? 0;
    const winBonus = replay.winner === side ? 0.1 : 0;
    return clamp(integrity * 0.85 + winBonus + 0.05 - fallacies * 0.05, 0, 1);
  });
  return per.reduce((s, x) => s + x, 0) / per.length;
}

/* ------------------------------------------------------------------ */
/* Seating the council                                                 */
/* ------------------------------------------------------------------ */

export type CouncilMode = 'quick' | 'council' | 'full';

export const SEATS_FOR_MODE: Record<CouncilMode, number> = { quick: 3, council: 7, full: 12 };

/**
 * Seat a council following the swarm's rules: one Questioner, one
 * Experimenter or Builder (reality tether), one Mind-Mapper or Awakener
 * (the human side), a wildcard from the wing farthest from home, then
 * fill — never two seats from the same wing (no two seats making the same
 * move). Full mode seats one genius per wing.
 *
 * `pick` chooses a genius from a wing (default: first listed = anchor);
 * pass a seeded random picker for variety.
 */
export function seatCouncil(
  mode: CouncilMode,
  opts: { homeWing?: WingId; pick?: (candidates: Genius[]) => Genius; prefer?: string[] } = {},
): Genius[] {
  const pick = opts.pick ?? ((c: Genius[]) => c[0]!);
  const preferred = (opts.prefer ?? []).map(getGenius);
  const home = opts.homeWing ?? 'formalizers';
  const n = SEATS_FOR_MODE[mode];

  let wingPlan: WingId[];
  if (mode === 'full') {
    wingPlan = [...WING_ORDER];
  } else {
    const required: WingId[] = ['questioners', 'experimenters', 'awakeners'];
    const wildcard = farthestWing(home, required);
    const rest = WING_ORDER.filter((w) => !required.includes(w) && w !== wildcard);
    // Quick mode: questioner + reality tether + human side (the wildcard
    // replaces the human side only if the home field IS the human side).
    wingPlan = mode === 'quick'
      ? [required[0]!, required[1]!, home === 'awakeners' || home === 'mind_mappers' ? wildcard : required[2]!]
      : [...required, wildcard, ...rest].slice(0, n);
    // Respect wings the caller explicitly asked for.
    const locked = new Set<WingId>([...required, ...preferred.map((p) => p.wing)]);
    for (const p of preferred) {
      if (wingPlan.includes(p.wing)) continue;
      for (let k = wingPlan.length - 1; k >= 0; k--) {
        if (!locked.has(wingPlan[k]!)) {
          wingPlan[k] = p.wing;
          break;
        }
      }
    }
  }

  return wingPlan.slice(0, n).map((wing) => {
    const want = preferred.find((p) => p.wing === wing);
    return want ?? pick(GENIUSES.filter((g) => g.wing === wing));
  });
}

/** Distance on the wing wheel — the wildcard comes from the far side. */
export function farthestWing(home: WingId, exclude: WingId[] = []): WingId {
  const i = WING_ORDER.indexOf(home);
  const len = WING_ORDER.length;
  let best: WingId = WING_ORDER[(i + len / 2) % len]!;
  let bestDist = -1;
  WING_ORDER.forEach((w, j) => {
    if (w === home || exclude.includes(w)) return;
    const d = Math.min(Math.abs(i - j), len - Math.abs(i - j));
    if (d > bestDist) {
      bestDist = d;
      best = w;
    }
  });
  return best;
}

/** Round-robin pairings (every seat fights every other seat once). */
export function roundRobin<T>(seats: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) pairs.push([seats[i]!, seats[j]!]);
  }
  return pairs;
}

export type PairingScheme = 'round-robin' | 'swiss';

export interface PairingOptions {
  /** Default: full round robin. */
  scheme?: PairingScheme;
  /** Hard cap on how many bouts to schedule. Ignored when larger than C(n,2). */
  boutCap?: number;
}

/**
 * Schedule bouts for a seated council.
 *
 * Round-robin is the default and stays complete unless `boutCap` trims it.
 * Swiss is a greedy even-coverage schedule: always pair the two unused
 * opponents who currently have the fewest bouts so a 7-seat council can
 * stop at ~7–10 fights instead of 21. Pairing is decided up front (no
 * mid-tournament re-seed from scores) so resume IDs stay stable.
 */
export function pairCouncil<T>(seats: T[], opts: PairingOptions = {}): [T, T][] {
  const all = roundRobin(seats);
  const cap = opts.boutCap ?? all.length;
  const limit = Math.max(0, Math.min(cap, all.length));
  if ((opts.scheme ?? 'round-robin') === 'round-robin') return all.slice(0, limit);
  return swissSchedule(seats, limit);
}

function swissSchedule<T>(seats: T[], cap: number): [T, T][] {
  const counts = seats.map(() => 0);
  const used = new Set<string>();
  const key = (i: number, j: number) => `${i}-${j}`;
  const out: [T, T][] = [];
  while (out.length < cap) {
    let bestI = -1;
    let bestJ = -1;
    let bestSum = Infinity;
    let bestMin = Infinity;
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        if (used.has(key(i, j))) continue;
        const sum = counts[i]! + counts[j]!;
        const mn = Math.min(counts[i]!, counts[j]!);
        const better =
          sum < bestSum ||
          (sum === bestSum && mn < bestMin) ||
          (sum === bestSum && mn === bestMin && (bestI < 0 || i < bestI || (i === bestI && j < bestJ)));
        if (better) {
          bestSum = sum;
          bestMin = mn;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI < 0) break;
    used.add(key(bestI, bestJ));
    counts[bestI]!++;
    counts[bestJ]!++;
    out.push([seats[bestI]!, seats[bestJ]!]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The crown                                                           */
/* ------------------------------------------------------------------ */

export interface CouncilVerdict {
  champion: ProposalScore;
  standings: ProposalScore[];
  /** The seat whose raw claim was highest — if it isn't the champion, the fights changed the answer. */
  loudestClaim: string;
  fightsChangedTheAnswer: boolean;
}

export function crownCouncil(
  proposals: Proposal[],
  profile: ValueProfile,
  bouts: BoutRecord[],
  skepticalPrior = SKEPTICAL_PRIOR,
): CouncilVerdict {
  if (proposals.length === 0) throw new Error('A council needs at least one proposal');
  const standings = proposals
    .map((p) =>
      scoreProposal(p, profile, credibilityFrom(bouts.filter((b) => b.seat === p.seat)), skepticalPrior),
    )
    .sort((a, b) => b.calibratedEV - a.calibratedEV);
  const loudest = [...standings].sort((a, b) => b.claimedEV - a.claimedEV)[0]!;
  const champion = standings[0]!;
  return {
    champion,
    standings,
    loudestClaim: loudest.seat,
    fightsChangedTheAnswer: loudest.seat !== champion.seat,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo;
}
