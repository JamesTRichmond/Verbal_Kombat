/**
 * runCouncil — the Swarm of Geniuses as a Verbal Kombat tournament.
 *
 *   1. Seat the council (quick 3 / council 7 / full 12).
 *   2. Every seat proposes an answer + outcomes (p × matters-to-owner).
 *   3. Round robin: every pair of seats fights. Each fighter's stance is its
 *      own proposal, so the blood on screen is the cross-examination of
 *      those proposals.
 *   4. Crown: fights set each seat's credibility; credibility calibrates the
 *      claimed odds and stakes; highest calibrated EV wins.
 *
 * Renderer-agnostic, same as runMatch: subscribe to onBout / onExchange.
 */

import {
  crownCouncil,
  geniusArchetype,
  roundRobin,
  seatCouncil,
  type BoutRecord,
  type CouncilMode,
  type CouncilVerdict,
  type Genius,
  type MatchConfig,
  type MatchReplay,
  type Proposal,
  type ValueProfile,
  type WingId,
} from '@vk/core';
import type { DebateAgent, ProposalAgent } from '@vk/debate';
import type { Judge } from '@vk/judge';
import { runMatch, type Exchange, type RunnerOptions } from './runner.js';

export interface CouncilConfig {
  id: string;
  problem: string;
  profile: ValueProfile;
  mode: CouncilMode;
  homeWing?: WingId;
  /** Genius slugs the user insists on seating. */
  prefer?: string[];
  /** Or seat an explicit list and skip the seating rules. */
  seats?: Genius[];
}

export interface CouncilDeps {
  proposer: ProposalAgent;
  /** Builds the debating mind for one seat in one bout. */
  debater: (seat: Genius, proposal: Proposal, boutId: string) => DebateAgent;
  judge: Judge;
}

export interface CouncilOptions extends Omit<RunnerOptions, 'archetypes' | 'onExchange'> {
  onProposal?: (proposal: Proposal) => void | Promise<void>;
  onBoutStart?: (bout: { id: string; A: Genius; B: Genius }) => void | Promise<void>;
  onExchange?: (boutId: string, exchange: Exchange) => void | Promise<void>;
  onBout?: (bout: { id: string; A: Genius; B: Genius; replay: MatchReplay }) => void | Promise<void>;
}

export interface CouncilResult {
  seats: Genius[];
  proposals: Proposal[];
  bouts: { id: string; A: string; B: string; replay: MatchReplay }[];
  verdict: CouncilVerdict;
}

export async function runCouncil(
  config: CouncilConfig,
  deps: CouncilDeps,
  opts: CouncilOptions = {},
): Promise<CouncilResult> {
  const seats =
    config.seats ??
    seatCouncil(config.mode, {
      ...(config.homeWing !== undefined ? { homeWing: config.homeWing } : {}),
      ...(config.prefer !== undefined ? { prefer: config.prefer } : {}),
    });

  const proposals: Proposal[] = [];
  for (const seat of seats) {
    const p = await deps.proposer.propose({ problem: config.problem, seat: seat.slug, profile: config.profile });
    proposals.push(p);
    await opts.onProposal?.(p);
  }
  const proposalFor = (slug: string) => proposals.find((p) => p.seat === slug)!;

  const records: BoutRecord[] = [];
  const bouts: CouncilResult['bouts'] = [];
  let n = 0;
  for (const [a, b] of roundRobin(seats)) {
    const id = `${config.id}-bout${++n}`;
    const pa = proposalFor(a.slug);
    const pb = proposalFor(b.slug);
    const match: MatchConfig = {
      id,
      topic: `${config.problem} — which answer should ${config.profile.ownerName} act on?`,
      stances: { A: pa.answer, B: pb.answer },
      fighters: { A: `genius:${a.slug}`, B: `genius:${b.slug}` },
      mode: 'problem',
      problemStatement: config.problem,
    };
    await opts.onBoutStart?.({ id, A: a, B: b });
    const { replay } = await runMatch(
      match,
      { A: deps.debater(a, pa, id), B: deps.debater(b, pb, id) },
      deps.judge,
      {
        ...opts,
        archetypes: { A: geniusArchetype(a.slug), B: geniusArchetype(b.slug) },
        onExchange: (ex) => opts.onExchange?.(id, ex),
      },
    );
    records.push({ seat: a.slug, replay, side: 'A' }, { seat: b.slug, replay, side: 'B' });
    bouts.push({ id, A: a.slug, B: b.slug, replay });
    await opts.onBout?.({ id, A: a, B: b, replay });
  }

  return { seats, proposals, bouts, verdict: crownCouncil(proposals, config.profile, records) };
}
