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
  grownArchetype,
  learnFromBout,
  lessonsForPrompt,
  newFighterRecord,
  type BoutLearning,
  type GeniusFighterRecord,
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

/**
 * Where fighter careers live. The runner reads a record before a seat
 * proposes and fights, and writes it back after every bout, so XP, lessons,
 * and logs persist across councils (file store in @vk/lab, localStorage in
 * the arcade, in-memory in tests).
 */
export interface FighterStore {
  get(slug: string): GeniusFighterRecord | Promise<GeniusFighterRecord>;
  put(record: GeniusFighterRecord): void | Promise<void>;
}

export class MemoryFighterStore implements FighterStore {
  readonly records = new Map<string, GeniusFighterRecord>();
  get(slug: string): GeniusFighterRecord {
    return this.records.get(slug) ?? newFighterRecord(slug);
  }
  put(record: GeniusFighterRecord): void {
    this.records.set(record.slug, record);
  }
}

export interface CouncilDeps {
  proposer: ProposalAgent;
  /** Builds the debating mind for one seat in one bout. */
  debater: (seat: Genius, proposal: Proposal, boutId: string) => DebateAgent;
  judge: Judge;
  /** Persist growth: when present, fighters fight as their grown selves and learn from every bout. */
  fighters?: FighterStore;
}

export interface CouncilOptions extends Omit<RunnerOptions, 'archetypes' | 'onExchange'> {
  onProposal?: (proposal: Proposal) => void | Promise<void>;
  onBoutStart?: (bout: { id: string; A: Genius; B: Genius }) => void | Promise<void>;
  onExchange?: (boutId: string, exchange: Exchange) => void | Promise<void>;
  onBout?: (bout: { id: string; A: Genius; B: Genius; replay: MatchReplay; resumed?: boolean }) => void | Promise<void>;
  /** Fired for each fighter after it learns from a bout. */
  onLearn?: (learning: BoutLearning) => void | Promise<void>;
  /** Timestamp source for log entries (tests pass a fixed clock). */
  now?: () => Date;
  /**
   * Resume an interrupted council: reuse saved proposals and finished bouts.
   * Resumed bouts are not re-learned (their growth was saved when they ran).
   */
  resume?: { proposals?: Proposal[]; bouts?: { id: string; replay: MatchReplay }[] };
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

  const store = deps.fighters;
  const now = opts.now ?? (() => new Date());
  const proposals: Proposal[] = [];
  for (const seat of seats) {
    const rec = store ? await store.get(seat.slug) : undefined;
    const cached = opts.resume?.proposals?.find((x) => x.seat === seat.slug);
    const lessons = rec ? lessonsForPrompt(rec) : [];
    const p = cached ?? await deps.proposer.propose({
      problem: config.problem,
      seat: seat.slug,
      profile: config.profile,
      ...(lessons.length > 0 ? { lessons } : {}),
    });
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
      stances: { A: stanceFromProposal(pa), B: stanceFromProposal(pb) },
      fighters: { A: `genius:${a.slug}`, B: `genius:${b.slug}` },
      mode: 'problem',
      problemStatement: config.problem,
    };
    const done = opts.resume?.bouts?.find((x) => x.id === id);
    if (done) {
      records.push({ seat: a.slug, replay: done.replay, side: 'A' }, { seat: b.slug, replay: done.replay, side: 'B' });
      bouts.push({ id, A: a.slug, B: b.slug, replay: done.replay });
      await opts.onBout?.({ id, A: a, B: b, replay: done.replay, resumed: true });
      continue;
    }
    await opts.onBoutStart?.({ id, A: a, B: b });
    const recA = store ? await store.get(a.slug) : undefined;
    const recB = store ? await store.get(b.slug) : undefined;
    const { replay } = await runMatch(
      match,
      { A: deps.debater(a, pa, id), B: deps.debater(b, pb, id) },
      deps.judge,
      {
        ...opts,
        archetypes: {
          A: recA ? grownArchetype(recA) : geniusArchetype(a.slug),
          B: recB ? grownArchetype(recB) : geniusArchetype(b.slug),
        },
        ...(recA && recB
          ? {
              lessons: {
                A: lessonsForPrompt(recA, { opponent: b.slug }),
                B: lessonsForPrompt(recB, { opponent: a.slug }),
              },
            }
          : {}),
        onExchange: (ex) => opts.onExchange?.(id, ex),
      },
    );
    records.push({ seat: a.slug, replay, side: 'A' }, { seat: b.slug, replay, side: 'B' });
    if (store && recA && recB) {
      const at = now().toISOString();
      for (const [rec, side, opp] of [
        [recA, 'A', b.slug],
        [recB, 'B', a.slug],
      ] as const) {
        const learning = learnFromBout(rec, { replay, side, opponentSlug: opp, boutId: id, at });
        await store.put(learning.record);
        await opts.onLearn?.(learning);
      }
    }
    bouts.push({ id, A: a.slug, B: b.slug, replay });
    await opts.onBout?.({ id, A: a, B: b, replay });
  }

  return { seats, proposals, bouts, verdict: crownCouncil(proposals, config.profile, records) };
}

function stanceFromProposal(proposal: Proposal): string {
  const outcomes = proposal.outcomes
    .map((o, i) => `${i + 1}. ${o.description} (p=${Math.max(0, Math.min(1, o.probability)).toFixed(2)})`)
    .join('\n');
  return outcomes.length > 0
    ? `${proposal.answer}\nPredicted outcomes:\n${outcomes}`
    : proposal.answer;
}
