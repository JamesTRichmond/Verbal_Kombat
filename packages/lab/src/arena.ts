/**
 * Agent Arena — plug any ChatClient in as a fighter and benchmark it.
 *
 * Every pair of entrants debates every topic, once per side assignment (and
 * `rounds` times over), through the real pipeline: LlmAgent → Judge →
 * CombatMapper → MatchReplay. Results roll up into a scorecard per entrant
 * and an Elo ladder updated in match order.
 */

import {
  GENIUS_ID_PREFIX,
  ROSTER,
  geniusArchetype,
  grownArchetype,
  learnFromBout,
  lessonsForPrompt,
  rewardSignal,
  type FighterArchetype,
  type MatchConfig,
  type MatchReplay,
  type Side,
} from '@vk/core';
import { LlmAgent, type ChatClient } from '@vk/debate';
import type { Judge } from '@vk/judge';
import { runMatch, type FighterStore } from '@vk/replay';
import { Ladder } from './elo.js';

export interface ArenaEntrant {
  id: string;
  client: ChatClient;
  /** A ROSTER id, or `genius:<slug>`. Defaults to the id when it starts with `genius:`, else the first ROSTER fighter. */
  archetypeId?: string;
}

export interface ArenaTopic {
  topic: string;
  stances: { A: string; B: string };
}

export interface ArenaConfig {
  entrants: ArenaEntrant[];
  topics: ArenaTopic[];
  judge: Judge;
  /** Repeats of the full schedule. Default 1. */
  rounds?: number;
  /** Utterances per side per match. Default 4. */
  maxTurns?: number;
  /** Elo K factor. Default 24. */
  k?: number;
  /** Prefix for match ids. Default "arena". */
  id?: string;
  /**
   * Persist growth: `genius:<slug>` entrants fight as their grown selves
   * (earned traits, wards, lessons in the prompt) and learn after every match.
   * Other entrants are unaffected.
   */
  fighters?: FighterStore;
  /** Timestamp source for fighter log entries. */
  now?: () => Date;
  onMatch?: (m: ArenaMatch) => void | Promise<void>;
}

export interface ArenaMatch {
  id: string;
  A: string;
  B: string;
  topic: string;
  /** Winning entrant id, or null for a draw. */
  winner: string | null;
  replay: MatchReplay;
}

export interface Scorecard {
  id: string;
  archetype: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgSoundness: number;
  /** Fallacies per argument. */
  fallacyRate: number;
  avgReward: number;
  elo: number;
}

export interface ArenaResult {
  /** Sorted by Elo, then win rate, then id. */
  scorecards: Scorecard[];
  matches: ArenaMatch[];
}

/** The genius slug an entrant fights as, if any. */
export function geniusSlugOf(entrant: Pick<ArenaEntrant, 'id' | 'archetypeId'>): string | undefined {
  const want = entrant.archetypeId ?? (entrant.id.startsWith(GENIUS_ID_PREFIX) ? entrant.id : undefined);
  return want?.startsWith(GENIUS_ID_PREFIX) ? want.slice(GENIUS_ID_PREFIX.length) : undefined;
}

export function resolveArchetype(entrant: Pick<ArenaEntrant, 'id' | 'archetypeId'>): FighterArchetype {
  const want = entrant.archetypeId ?? (entrant.id.startsWith('genius:') ? entrant.id : undefined);
  if (want?.startsWith('genius:')) return geniusArchetype(want.slice('genius:'.length));
  if (want !== undefined) {
    const found = ROSTER.find((r) => r.id === want);
    if (!found) throw new Error(`Unknown archetype: ${want}`);
    return found;
  }
  const first = ROSTER[0];
  if (!first) throw new Error('ROSTER is empty');
  return first;
}

interface Tally {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  arguments: number;
  soundnessSum: number;
  fallacies: number;
  rewardSum: number;
}

export async function benchmarkAgents(config: ArenaConfig): Promise<ArenaResult> {
  const { entrants, topics, judge } = config;
  if (entrants.length < 2) throw new Error('benchmarkAgents needs at least two entrants');
  if (topics.length === 0) throw new Error('benchmarkAgents needs at least one topic');
  const ids = new Set(entrants.map((e) => e.id));
  if (ids.size !== entrants.length) throw new Error('Entrant ids must be unique');

  const rounds = config.rounds ?? 1;
  const maxTurns = config.maxTurns ?? 4;
  const prefix = config.id ?? 'arena';
  const ladder = new Ladder(config.k !== undefined ? { k: config.k } : {});
  const archetypes = new Map(entrants.map((e) => [e.id, resolveArchetype(e)]));
  const tallies = new Map<string, Tally>(
    entrants.map((e) => [
      e.id,
      { matches: 0, wins: 0, losses: 0, draws: 0, arguments: 0, soundnessSum: 0, fallacies: 0, rewardSum: 0 },
    ]),
  );
  for (const e of entrants) ladder.add(e.id);

  const matches: ArenaMatch[] = [];
  let n = 0;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < entrants.length; i++) {
      for (let j = i + 1; j < entrants.length; j++) {
        for (const topic of topics) {
          const pair = [entrants[i]!, entrants[j]!] as const;
          for (const [a, b] of [pair, [pair[1], pair[0]] as const]) {
            const id = `${prefix}-m${++n}`;
            const match: MatchConfig = {
              id,
              topic: topic.topic,
              stances: { A: topic.stances.A, B: topic.stances.B },
              fighters: { A: archetypes.get(a.id)!.id, B: archetypes.get(b.id)!.id },
              mode: 'ranked',
            };
            const store = config.fighters;
            const slugA = store ? geniusSlugOf(a) : undefined;
            const slugB = store ? geniusSlugOf(b) : undefined;
            const recA = store && slugA ? await store.get(slugA) : undefined;
            const recB = store && slugB ? await store.get(slugB) : undefined;
            const oppKey = (e: ArenaEntrant, slug: string | undefined) => slug ?? e.id;
            const lessons = {
              ...(recA ? { A: lessonsForPrompt(recA, { opponent: oppKey(b, slugB) }) } : {}),
              ...(recB ? { B: lessonsForPrompt(recB, { opponent: oppKey(a, slugA) }) } : {}),
            };
            const { replay } = await runMatch(
              match,
              { A: new LlmAgent(a.client, { maxTurns }), B: new LlmAgent(b.client, { maxTurns }) },
              judge,
              {
                maxTurns: maxTurns * 2,
                archetypes: {
                  A: recA ? grownArchetype(recA) : archetypes.get(a.id)!,
                  B: recB ? grownArchetype(recB) : archetypes.get(b.id)!,
                },
                ...(recA || recB ? { lessons } : {}),
              },
            );
            if (store) {
              const at = (config.now ?? (() => new Date()))().toISOString();
              for (const [slug, side, opp] of [
                [slugA, 'A', oppKey(b, slugB)],
                [slugB, 'B', oppKey(a, slugA)],
              ] as const) {
                if (!slug) continue;
                // Re-read: the same genius may sit on both sides.
                const learning = learnFromBout(await store.get(slug), { replay, side, opponentSlug: opp, boutId: id, at });
                await store.put(learning.record);
              }
            }
            const winner = replay.winner === 'A' ? a.id : replay.winner === 'B' ? b.id : null;
            ladder.record(a.id, b.id, winner);
            tallyMatch(tallies.get(a.id)!, replay, 'A');
            tallyMatch(tallies.get(b.id)!, replay, 'B');
            const m: ArenaMatch = { id, A: a.id, B: b.id, topic: topic.topic, winner, replay };
            matches.push(m);
            await config.onMatch?.(m);
          }
        }
      }
    }
  }

  const scorecards = entrants
    .map((e): Scorecard => {
      const t = tallies.get(e.id)!;
      return {
        id: e.id,
        archetype: archetypes.get(e.id)!.id,
        matches: t.matches,
        wins: t.wins,
        losses: t.losses,
        draws: t.draws,
        winRate: t.matches === 0 ? 0 : t.wins / t.matches,
        avgSoundness: t.arguments === 0 ? 0 : t.soundnessSum / t.arguments,
        fallacyRate: t.arguments === 0 ? 0 : t.fallacies / t.arguments,
        avgReward: t.matches === 0 ? 0 : t.rewardSum / t.matches,
        elo: ladder.rating(e.id),
      };
    })
    .sort((x, y) => y.elo - x.elo || y.winRate - x.winRate || x.id.localeCompare(y.id));

  return { scorecards, matches };
}

function tallyMatch(t: Tally, replay: MatchReplay, side: Side): void {
  const s = replay.stats[side];
  t.matches++;
  if (replay.winner === side) t.wins++;
  else if (replay.winner === undefined) t.draws++;
  else t.losses++;
  t.arguments += s.arguments;
  t.soundnessSum += s.avgSoundness * s.arguments;
  t.fallacies += s.fallacies;
  t.rewardSum += rewardSignal(replay, side);
}

/** Fixed-width text table for terminals and CI logs. */
export function renderScorecards(cards: Scorecard[]): string {
  const header = ['entrant', 'elo', 'W-L-D', 'win%', 'sound', 'fall/arg', 'reward'];
  const rows = cards.map((c) => [
    c.id,
    c.elo.toFixed(0),
    `${c.wins}-${c.losses}-${c.draws}`,
    (c.winRate * 100).toFixed(0),
    c.avgSoundness.toFixed(2),
    c.fallacyRate.toFixed(2),
    c.avgReward.toFixed(2),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ').trimEnd();
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}
