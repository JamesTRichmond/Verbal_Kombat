/**
 * Precomputed match data. Nothing here renders: the pipeline runs to
 * completion first, then the arcade plays the replays back on a timeline.
 */

import {
  credibilityFrom,
  getGenius,
  grownArchetype,
  opponent,
  scoreProposal,
  type BoutRecord,
  type GeniusFighterRecord,
  type Genius,
  type MatchReplay,
  type ProposalScore,
  type Side,
} from '@vk/core';
import { FREE_WILL, ScriptedAgent } from '@vk/debate';
import { ScriptAwareJudge } from '@vk/judge';
import { runCouncil, runMatch, type CouncilResult } from '@vk/replay';
import type { ArenaId } from './arenas.js';
import {
  COUNCIL_BOUTS,
  COUNCIL_PROBLEM,
  COUNCIL_PROFILE,
  COUNCIL_SEATS,
  CouncilScriptJudge,
  councilDebater,
  councilIsCloser,
  councilPlayId,
  councilProposer,
  scriptKey,
} from './demo-council.js';
import { careers, type LearnedSide } from './careers.js';

export const EXHIBITION_TOPIC = FREE_WILL.topic;
export const EXHIBITION_STANCES = FREE_WILL.stances;

let matchSerial = 0;

export async function computeExhibition(a: string, b: string): Promise<MatchReplay> {
  const isCloser = (arg: { text: string }) =>
    FREE_WILL.lines.find((l) => l.text === arg.text)?.annotations?.isCloser === true;
  const { replay } = await runMatch(
    {
      id: `exhibition-${++matchSerial}`,
      topic: FREE_WILL.topic,
      stances: FREE_WILL.stances,
      fighters: { A: `genius:${a}`, B: `genius:${b}` },
      mode: 'exhibition',
    },
    { A: new ScriptedAgent(FREE_WILL, 'A'), B: new ScriptedAgent(FREE_WILL, 'B') },
    new ScriptAwareJudge(FREE_WILL),
    { isCloser, archetypes: { A: grownArchetype(careers.get(a)), B: grownArchetype(careers.get(b)) } },
  );
  return replay;
}

export interface BoutPlay {
  id: string;
  A: Genius;
  B: Genius;
  replay: MatchReplay;
  arena: ArenaId;
  /** What each fighter learned from this bout (already saved to careers). */
  learned: Record<Side, LearnedSide>;
}

export interface CouncilPlay {
  problem: string;
  result: CouncilResult;
  bouts: BoutPlay[];
}

const COUNCIL_ARENAS: ArenaId[] = ['warroom', 'forge', 'library'];

export async function computeCouncil(): Promise<CouncilPlay> {
  const seats = COUNCIL_SEATS.map((s) => getGenius(s));
  const before = new Map<string, Record<string, GeniusFighterRecord>>();
  const learned = new Map<string, Partial<Record<Side, LearnedSide>>>();
  const result = await runCouncil(
    { id: councilPlayId(), problem: COUNCIL_PROBLEM, profile: COUNCIL_PROFILE, mode: 'quick', seats },
    {
      proposer: councilProposer(),
      debater: (seat, _proposal, boutId) =>
        councilDebater(seat.slug, boutId, COUNCIL_BOUTS[scriptKey(boutId)]?.[0]?.seat ?? seat.slug),
      judge: new CouncilScriptJudge(),
      fighters: careers,
    },
    {
      isCloser: councilIsCloser,
      onBoutStart: ({ id, A, B }) => {
        before.set(id, { A: careers.get(A.slug), B: careers.get(B.slug) });
      },
      onLearn: (learning) => {
        const id = learning.entry.boutId;
        const side = learning.entry.side;
        const snap = before.get(id)?.[side] ?? learning.record;
        learned.set(id, { ...(learned.get(id) ?? {}), [side]: { before: snap, learning } });
      },
    },
  );
  const bouts = result.bouts.map((b, i) => {
    const l = learned.get(b.id);
    if (!l?.A || !l.B) throw new Error(`council: no learning recorded for ${b.id}`);
    return {
      id: b.id,
      A: getGenius(b.A),
      B: getGenius(b.B),
      replay: b.replay,
      arena: COUNCIL_ARENAS[i % COUNCIL_ARENAS.length]!,
      learned: { A: l.A, B: l.B },
    };
  });
  return { problem: COUNCIL_PROBLEM, result, bouts };
}

/** EV standings (in seat order) after the first `played` bouts. */
export function evSnapshot(play: CouncilPlay, played: number): ProposalScore[] {
  const records: BoutRecord[] = [];
  for (const b of play.bouts.slice(0, played)) {
    records.push({ seat: b.A.slug, replay: b.replay, side: 'A' }, { seat: b.B.slug, replay: b.replay, side: 'B' });
  }
  return play.result.proposals.map((p) =>
    scoreProposal(p, COUNCIL_PROFILE, credibilityFrom(records.filter((r) => r.seat === p.seat))),
  );
}

/** Integrity of both sides after each entry (index i = after entry i). */
export function integrityTimeline(replay: MatchReplay): Record<Side, number>[] {
  const hp: Record<Side, number> = { A: 100, B: 100 };
  return replay.entries.map((e) => {
    for (const c of e.combat) {
      const t = opponent(c.actor);
      hp[t] = Math.max(0, hp[t] - c.damage);
      hp[c.actor] = Math.max(0, hp[c.actor] - c.selfDamage);
    }
    return { ...hp };
  });
}
