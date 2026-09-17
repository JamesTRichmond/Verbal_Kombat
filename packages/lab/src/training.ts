/**
 * Training camp — genius self-play that grows the roster.
 *
 * Each bout picks two geniuses (seeded, so a run is reproducible), fights
 * them as their GROWN selves (grownArchetype + lessons in the system
 * prompt), then both learn from the bout (learnFromBout) and are persisted.
 * Nothing is ever taken away from a fighter; see docs/GROWTH.md.
 */

import {
  GENIUSES,
  WING_ORDER,
  grownArchetype,
  learnFromBout,
  lessonsForPrompt,
  type Genius,
  type GeniusFighterRecord,
  type MatchConfig,
  type MatchReplay,
} from '@vk/core';
import { LlmAgent, type ChatClient } from '@vk/debate';
import type { Judge } from '@vk/judge';
import { runMatch, type FighterStore } from '@vk/replay';
import type { ArenaTopic } from './arena.js';
import { seededRandom } from './mock-client.js';
import { rankFighters } from './roster-store.js';

export type Pairing = 'random' | 'weakest-vs-strongest' | 'wing-rivals' | 'least-fought';
export const PAIRINGS: Pairing[] = ['random', 'weakest-vs-strongest', 'wing-rivals', 'least-fought'];

export interface TrainingConfig {
  store: FighterStore;
  bouts: number;
  judge: Judge;
  /** The mind behind one genius for one bout. */
  clientFor: (slug: string, boutId: string) => ChatClient;
  topics: ArenaTopic[];
  seed: number;
  /**
   * random: any two geniuses.
   * weakest-vs-strongest: one from the bottom quarter of the standings vs one from the top quarter.
   * wing-rivals: two geniuses from two different wings.
   */
  pairing?: Pairing;
  /** Utterances per side per bout. Default 3. */
  maxTurns?: number;
  /** Bout id prefix. Default `camp-s<seed>`. */
  id?: string;
  /** Clock for log timestamps; each bout is stamped now() + bout index seconds. */
  now?: () => Date;
  /** Limit the pool (default: all 186 geniuses). */
  pool?: Genius[];
  onBout?: (bout: TrainingBout) => void | Promise<void>;
}

export interface TrainingBout {
  id: string;
  A: string;
  B: string;
  topic: string;
  winner: string | null;
  replay: MatchReplay;
  /** Lessons newly learned in this bout, per slug. */
  learned: Record<string, number>;
}

export interface FighterGain {
  slug: string;
  name: string;
  bouts: number;
  xpGained: number;
  lessonsGained: number;
  levelBefore: number;
  levelAfter: number;
}

export interface TrainingSummary {
  bouts: number;
  fighters: FighterGain[];
  levelUps: FighterGain[];
  lessonsGained: number;
  xpGained: number;
}

export async function trainingCamp(config: TrainingConfig): Promise<TrainingSummary> {
  const { store, judge, topics } = config;
  if (topics.length === 0) throw new Error('trainingCamp needs at least one topic');
  const pool = config.pool ?? GENIUSES;
  if (pool.length < 2) throw new Error('trainingCamp needs at least two geniuses');
  const pairing = config.pairing ?? 'random';
  if (!PAIRINGS.includes(pairing)) throw new Error(`Unknown pairing: ${pairing}`);
  const rand = seededRandom(config.seed);
  const maxTurns = config.maxTurns ?? 3;
  const prefix = config.id ?? `camp-s${config.seed}`;
  const start = (config.now ?? (() => new Date()))().getTime();
  const gains = new Map<string, FighterGain>();

  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

  const choosePair = async (): Promise<[Genius, Genius]> => {
    if (pairing === 'weakest-vs-strongest') {
      const recs: GeniusFighterRecord[] = [];
      for (const g of pool) recs.push(await store.get(g.slug));
      const ranked = rankFighters(recs);
      const q = Math.max(1, Math.floor(ranked.length / 4));
      const strong = pick(ranked.slice(0, q));
      const weak = pick(ranked.slice(-q).filter((r) => r.slug !== strong.slug));
      const bySlug = (s: string) => pool.find((g) => g.slug === s)!;
      return [bySlug(weak.slug), bySlug(strong.slug)];
    }
    if (pairing === 'least-fought') {
      // Whole-roster leveling: the two fighters with the fewest bouts meet
      // (ties broken at random), so nobody is left behind.
      const recs: GeniusFighterRecord[] = [];
      for (const g of pool) recs.push(await store.get(g.slug));
      const fewest = Math.min(...recs.map((r) => r.record.matches));
      const low = recs.filter((r) => r.record.matches === fewest);
      const bySlug = (s: string) => pool.find((g) => g.slug === s)!;
      const a = pick(low);
      const rest = recs.filter((r) => r.slug !== a.slug);
      const next = Math.min(...rest.map((r) => r.record.matches));
      const b = pick(rest.filter((r) => r.record.matches === next));
      return [bySlug(a.slug), bySlug(b.slug)];
    }
    if (pairing === 'wing-rivals') {
      const wings = WING_ORDER.filter((w) => pool.some((g) => g.wing === w));
      if (wings.length >= 2) {
        const w1 = pick(wings);
        const w2 = pick(wings.filter((w) => w !== w1));
        return [pick(pool.filter((g) => g.wing === w1)), pick(pool.filter((g) => g.wing === w2))];
      }
    }
    const a = pick(pool);
    const b = pick(pool.filter((g) => g.slug !== a.slug));
    return [a, b];
  };

  for (let i = 1; i <= config.bouts; i++) {
    const [first, second] = await choosePair();
    // Random side assignment and topic.
    const [a, b] = rand() < 0.5 ? [first, second] : [second, first];
    const topic = pick(topics);
    const id = `${prefix}-b${i}`;
    const at = new Date(start + (i - 1) * 1000).toISOString();

    const recA = await store.get(a.slug);
    const recB = await store.get(b.slug);
    const match: MatchConfig = {
      id,
      topic: topic.topic,
      stances: { A: topic.stances.A, B: topic.stances.B },
      fighters: { A: `genius:${a.slug}`, B: `genius:${b.slug}` },
      mode: 'ranked',
    };
    const { replay } = await runMatch(
      match,
      {
        A: new LlmAgent(config.clientFor(a.slug, id), { maxTurns }),
        B: new LlmAgent(config.clientFor(b.slug, id), { maxTurns }),
      },
      judge,
      {
        maxTurns: maxTurns * 2,
        archetypes: { A: grownArchetype(recA), B: grownArchetype(recB) },
        lessons: {
          A: lessonsForPrompt(recA, { opponent: b.slug }),
          B: lessonsForPrompt(recB, { opponent: a.slug }),
        },
      },
    );

    const learned: Record<string, number> = {};
    for (const [rec, side, opp] of [
      [recA, 'A', b.slug],
      [recB, 'B', a.slug],
    ] as const) {
      const l = learnFromBout(rec, { replay, side, opponentSlug: opp, boutId: id, at });
      await store.put(l.record);
      learned[rec.slug] = l.newLessons.length;
      const g = gains.get(rec.slug) ?? {
        slug: rec.slug,
        name: rec.name,
        bouts: 0,
        xpGained: 0,
        lessonsGained: 0,
        levelBefore: rec.level,
        levelAfter: rec.level,
      };
      g.bouts++;
      g.xpGained += l.entry.xpGained;
      g.lessonsGained += l.newLessons.length;
      g.levelAfter = l.record.level;
      gains.set(rec.slug, g);
    }

    const winner = replay.winner === 'A' ? a.slug : replay.winner === 'B' ? b.slug : null;
    await config.onBout?.({ id, A: a.slug, B: b.slug, topic: topic.topic, winner, replay, learned });
  }

  const fighters = [...gains.values()].sort((x, y) => y.xpGained - x.xpGained || x.slug.localeCompare(y.slug));
  return {
    bouts: config.bouts,
    fighters,
    levelUps: fighters.filter((f) => f.levelAfter > f.levelBefore),
    lessonsGained: fighters.reduce((n, f) => n + f.lessonsGained, 0),
    xpGained: fighters.reduce((n, f) => n + f.xpGained, 0),
  };
}

export function renderTrainingSummary(s: TrainingSummary, top = 10): string {
  const lines = [
    `Training camp: ${s.bouts} bouts · ${s.fighters.length} fighters · +${s.xpGained} XP · ${s.lessonsGained} new lessons · ${s.levelUps.length} level-ups`,
  ];
  if (s.levelUps.length > 0) {
    lines.push('', 'Level-ups:');
    for (const f of s.levelUps) lines.push(`  ${f.name}: Lv ${f.levelBefore} → ${f.levelAfter}`);
  }
  lines.push('', `Top ${Math.min(top, s.fighters.length)} by XP gained:`);
  for (const f of s.fighters.slice(0, top)) {
    lines.push(`  ${f.name.padEnd(32)} +${String(f.xpGained).padStart(4)} XP  +${f.lessonsGained} lessons  ${f.bouts} bout(s)`);
  }
  return lines.join('\n');
}
