/**
 * Decision Lab — the council as a decision instrument.
 *
 * Wraps runCouncil and adds what a real decision needs:
 *  - a "status quo / do nothing" baseline every answer must beat on EV;
 *  - sensitivity: which value weight, halved or doubled, flips the verdict;
 *  - optional credibility priors from the DecisionJournal (seats that
 *    predicted well before get more benefit of the doubt);
 *  - a JSON decision record + a short markdown report.
 */

import {
  credibilityFrom,
  scoreProposal,
  type BoutRecord,
  type CouncilMode,
  type Genius,
  type Proposal,
  type ProposalScore,
  type ValueProfile,
  type WingId,
} from '@vk/core';
import type { DebateAgent, ProposalAgent } from '@vk/debate';
import type { Judge } from '@vk/judge';
import { runCouncil, type CouncilOptions, type CouncilResult, type FighterStore } from '@vk/replay';

export const STATUS_QUO_SEAT = 'status-quo';
export const STATUS_QUO_CREDIBILITY = 0.5;

/** Doing nothing: it certainly happens, and by default it moves nothing. */
export function defaultStatusQuo(): Proposal {
  return {
    seat: STATUS_QUO_SEAT,
    answer: 'Status quo — do nothing and keep the current course.',
    reasoning: 'Baseline: every proposal must beat not acting.',
    outcomes: [{ description: 'Nothing changes', probability: 1, impacts: {} }],
  };
}

export interface DecisionConfig {
  problem: string;
  profile: ValueProfile;
  mode: CouncilMode;
  proposer: ProposalAgent;
  debater: (seat: Genius, proposal: Proposal, boutId: string) => DebateAgent;
  judge: Judge;
  statusQuo?: Proposal;
  id?: string;
  seats?: Genius[];
  prefer?: string[];
  homeWing?: WingId;
  /** Per-seat 0..1 priors (e.g. DecisionJournal.credibilityPriors()). */
  credibilityPriors?: Record<string, number>;
  /** How much a known prior counts against fight credibility (0..1). Default 0.3. */
  priorWeight?: number;
  runner?: CouncilOptions;
  /** Persist growth: seats fight as their grown selves and learn from every bout. */
  fighters?: FighterStore;
}

export type SensitivityDirection = 'halve' | 'double';

export interface SensitivityEntry {
  criterionId: string;
  direction: SensitivityDirection;
  factor: number;
  /** Champion seat under the scaled profile. */
  champion: string;
  flips: boolean;
  beatsStatusQuo: boolean;
}

export interface DecisionResult {
  id: string;
  problem: string;
  profile: ValueProfile;
  mode: CouncilMode;
  council: CouncilResult;
  /** Seat credibility after blending in priors (equal to fight credibility without priors). */
  credibility: Record<string, number>;
  standings: ProposalScore[];
  champion: ProposalScore;
  statusQuo: Proposal;
  baseline: ProposalScore;
  beatsStatusQuo: boolean;
  sensitivity: SensitivityEntry[];
}

export async function runDecision(config: DecisionConfig): Promise<DecisionResult> {
  const id = config.id ?? 'decision';
  const council = await runCouncil(
    {
      id,
      problem: config.problem,
      profile: config.profile,
      mode: config.mode,
      ...(config.seats !== undefined ? { seats: config.seats } : {}),
      ...(config.prefer !== undefined ? { prefer: config.prefer } : {}),
      ...(config.homeWing !== undefined ? { homeWing: config.homeWing } : {}),
    },
    {
      proposer: config.proposer,
      debater: config.debater,
      judge: config.judge,
      ...(config.fighters !== undefined ? { fighters: config.fighters } : {}),
    },
    config.runner ?? {},
  );

  const records: BoutRecord[] = council.bouts.flatMap((b) => [
    { seat: b.A, replay: b.replay, side: 'A' as const },
    { seat: b.B, replay: b.replay, side: 'B' as const },
  ]);
  const w = clamp01(config.priorWeight ?? 0.3);
  const credibility: Record<string, number> = {};
  for (const p of council.proposals) {
    const fought = credibilityFrom(records.filter((r) => r.seat === p.seat));
    const prior = config.credibilityPriors?.[p.seat];
    credibility[p.seat] = prior === undefined ? fought : (1 - w) * fought + w * clamp01(prior);
  }

  const statusQuo = config.statusQuo === undefined
    ? defaultStatusQuo()
    : { ...config.statusQuo, seat: STATUS_QUO_SEAT };
  const standings = rank(council.proposals, config.profile, credibility);
  const champion = standings[0]!;
  const baseline = scoreProposal(statusQuo, config.profile, STATUS_QUO_CREDIBILITY);

  const sensitivity: SensitivityEntry[] = [];
  for (const criterion of config.profile.criteria) {
    for (const [direction, factor] of [['halve', 0.5], ['double', 2]] as const) {
      const scaled: ValueProfile = {
        ...config.profile,
        criteria: config.profile.criteria.map((c) =>
          c.id === criterion.id ? { ...c, weight: c.weight * factor } : c,
        ),
      };
      const top = rank(council.proposals, scaled, credibility)[0]!;
      const base = scoreProposal(statusQuo, scaled, STATUS_QUO_CREDIBILITY);
      sensitivity.push({
        criterionId: criterion.id,
        direction,
        factor,
        champion: top.seat,
        flips: top.seat !== champion.seat,
        beatsStatusQuo: top.calibratedEV > base.calibratedEV,
      });
    }
  }

  return {
    id,
    problem: config.problem,
    profile: config.profile,
    mode: config.mode,
    council,
    credibility,
    standings,
    champion,
    statusQuo,
    baseline,
    beatsStatusQuo: champion.calibratedEV > baseline.calibratedEV,
    sensitivity,
  };
}

function rank(proposals: Proposal[], profile: ValueProfile, credibility: Record<string, number>): ProposalScore[] {
  // Stable sort keeps seating order on ties, so the result is deterministic.
  return proposals
    .map((p) => scoreProposal(p, profile, credibility[p.seat] ?? STATUS_QUO_CREDIBILITY))
    .sort((a, b) => b.calibratedEV - a.calibratedEV);
}

/* ------------------------------------------------------------------ */
/* Decision record                                                     */
/* ------------------------------------------------------------------ */

export interface PredictedOutcome {
  seat: string;
  outcomeIndex: number;
  description: string;
  probability: number;
  matters: number;
}

export interface DecisionRecord {
  id: string;
  timestamp: string;
  problem: string;
  mode: CouncilMode;
  profile: ValueProfile;
  seats: { slug: string; name: string; wing: string }[];
  proposals: Proposal[];
  statusQuo: Proposal;
  standings: { seat: string; claimedEV: number; credibility: number; calibratedEV: number; probabilityOverflow?: number }[];
  baseline: { claimedEV: number; calibratedEV: number };
  champion: { seat: string; answer: string; calibratedEV: number };
  beatsStatusQuo: boolean;
  fightsChangedTheAnswer: boolean;
  bouts: { id: string; A: string; B: string; winner: string | null }[];
  sensitivity: SensitivityEntry[];
  predictions: PredictedOutcome[];
}

export function decisionRecord(result: DecisionResult, now: Date = new Date()): DecisionRecord {
  const champ = result.council.proposals.find((p) => p.seat === result.champion.seat);
  const loudest = [...result.standings].sort((a, b) => b.claimedEV - a.claimedEV)[0];
  const scored = [...result.standings, result.baseline];
  const predictions: PredictedOutcome[] = [...result.council.proposals, result.statusQuo].flatMap((p) => {
    const score = scored.find((s) => s.seat === p.seat);
    return p.outcomes.map((o, i) => ({
      seat: p.seat,
      outcomeIndex: i,
      description: o.description,
      probability: o.probability,
      matters: score?.outcomes[i]?.matters ?? 0,
    }));
  });
  const record: DecisionRecord = {
    id: result.id,
    timestamp: now.toISOString(),
    problem: result.problem,
    mode: result.mode,
    profile: result.profile,
    seats: result.council.seats.map((g) => ({ slug: g.slug, name: g.name, wing: g.wing })),
    proposals: result.council.proposals,
    statusQuo: result.statusQuo,
    standings: result.standings.map((s) => ({
      seat: s.seat,
      claimedEV: s.claimedEV,
      credibility: s.credibility,
      calibratedEV: s.calibratedEV,
      ...(s.probabilityOverflow !== undefined ? { probabilityOverflow: s.probabilityOverflow } : {}),
    })),
    baseline: { claimedEV: result.baseline.claimedEV, calibratedEV: result.baseline.calibratedEV },
    champion: {
      seat: result.champion.seat,
      answer: champ?.answer ?? '',
      calibratedEV: result.champion.calibratedEV,
    },
    beatsStatusQuo: result.beatsStatusQuo,
    fightsChangedTheAnswer: loudest !== undefined && loudest.seat !== result.champion.seat,
    bouts: result.council.bouts.map((b) => ({
      id: b.id,
      A: b.A,
      B: b.B,
      winner: b.replay.winner === 'A' ? b.A : b.replay.winner === 'B' ? b.B : null,
    })),
    sensitivity: result.sensitivity,
    predictions,
  };
  // Guarantee plain JSON (drops undefined, catches accidental non-serializables).
  return JSON.parse(JSON.stringify(record)) as DecisionRecord;
}

export function renderDecisionMarkdown(record: DecisionRecord): string {
  const f = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(3);
  const nameOf = (slug: string) =>
    slug === STATUS_QUO_SEAT ? 'Status quo' : record.seats.find((s) => s.slug === slug)?.name ?? slug;
  const flips = record.sensitivity.filter((s) => s.flips);
  const lines = [
    `# Decision: ${record.problem}`,
    '',
    `_${record.timestamp} · ${record.mode} council · for ${record.profile.ownerName} · record \`${record.id}\`_`,
    '',
    `## Verdict`,
    '',
    `**${nameOf(record.champion.seat)}** — ${record.champion.answer}`,
    '',
    `Calibrated EV ${f(record.champion.calibratedEV)} vs status quo ${f(record.baseline.calibratedEV)}: ` +
      (record.beatsStatusQuo ? '**beats doing nothing.**' : '**does NOT beat doing nothing — consider holding.**'),
    ...(record.fightsChangedTheAnswer
      ? ['', 'The fights changed the answer: the loudest claim did not win the crown.']
      : []),
    '',
    '## Standings',
    '',
    '| # | Seat | Claimed EV | Credibility | Calibrated EV |',
    '|---|---|---|---|---|',
    ...record.standings.map(
      (s, i) => `| ${i + 1} | ${nameOf(s.seat)} | ${f(s.claimedEV)} | ${s.credibility.toFixed(2)} | ${f(s.calibratedEV)} |`,
    ),
    `| – | Status quo | ${f(record.baseline.claimedEV)} | 0.50 | ${f(record.baseline.calibratedEV)} |`,
    '',
    ...(record.standings.some((s) => s.probabilityOverflow)
      ? [
          '### Odds that could not be true',
          '',
          ...record.standings
            .filter((s) => s.probabilityOverflow)
            .map(
              (s) =>
                `- ${nameOf(s.seat)}: its outcome probabilities summed to ${(1 + (s.probabilityOverflow ?? 0)).toFixed(2)}; scaled back to 1 before scoring.`,
            ),
          '',
        ]
      : []),
    '## Sensitivity',
    '',
    flips.length === 0
      ? 'Robust: halving or doubling any single weight keeps the same champion.'
      : flips
          .map((s) => `- ${s.direction === 'halve' ? 'Halving' : 'Doubling'} **${s.criterionId}** crowns ${nameOf(s.champion)} instead.`)
          .join('\n'),
    '',
    '## Predictions to resolve later',
    '',
    ...record.predictions
      .filter((p) => p.seat === record.champion.seat || p.seat === STATUS_QUO_SEAT)
      .map((p) => `- [${nameOf(p.seat)} #${p.outcomeIndex}] ${p.description} — p=${p.probability.toFixed(2)}, matters ${f(p.matters)}`),
    '',
  ];
  return lines.join('\n');
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}
