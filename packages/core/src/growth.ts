/**
 * Growth — every genius fighter keeps a persistent career.
 *
 * Canon extension (docs/GROWTH.md):
 *  - XP persists. Levels come from XP.
 *  - Every fighter keeps an individual log: one entry per bout, forever.
 *  - Learning is ADDITIVE. A bout can add lessons, add fallacy wards, and
 *    add trait gains. Nothing a fighter has learned is ever overwritten or
 *    removed; a lesson learned again is reinforced (its `seen` count grows).
 *  - The loser always learns: it studies its own mistakes AND the move that
 *    beat it, and it earns lesson XP for doing so. The winner learns too,
 *    but less.
 *
 * Lessons are phrased as instructions so they can be injected straight into
 * the fighter's system prompt — which is how learning changes how it argues.
 */

import { FALLACIES, type FallacyId } from './fallacies.js';
import type { FighterArchetype, Side, StyleTraits } from './fighters.js';
import { XP_PER_LEVEL, levelForXp } from './fighters.js';
import { WINGS, geniusArchetype, getGenius, type WingId } from './geniuses.js';
import { opponent } from './match.js';
import { xpForMatch } from './progression.js';
import type { MatchReplay, TranscriptEntry } from './replay.js';

export type LessonKind = 'avoid_fallacy' | 'counter' | 'technique' | 'blind_spot';

export interface Lesson {
  /** Stable key; the same lesson learned twice is reinforced, not duplicated. */
  id: string;
  kind: LessonKind;
  /** An instruction the fighter can act on next time. */
  text: string;
  learnedFrom: string;
  opponent?: string;
  learnedAt: string;
  /** Times this lesson has been (re)learned. Only ever grows. */
  seen: number;
}

export interface Strengths {
  /** Earned resistance per fallacy, 0..MAX_WARD. Only ever grows. */
  fallacyWards: Partial<Record<FallacyId, number>>;
  /** Earned trait gains, 0..MAX_TRAIT_GAIN each. Only ever grow. */
  traitGains: Partial<StyleTraits>;
}

export type BoutResult = 'win' | 'loss' | 'draw';

export interface FighterLogEntry {
  boutId: string;
  at: string;
  opponent: string;
  side: Side;
  result: BoutResult;
  topic: string;
  stance: string;
  finalIntegrity: number;
  opponentIntegrity: number;
  arguments: number;
  avgSoundness: number;
  fallacies: FallacyId[];
  bestMove?: string;
  xpGained: number;
  lessonsGained: string[];
  lessonsReinforced: string[];
  levelAfter: number;
}

export interface GeniusFighterRecord {
  version: 1;
  slug: string;
  name: string;
  wing: WingId;
  xp: number;
  level: number;
  record: { matches: number; wins: number; losses: number; draws: number; fallaciesCommitted: number };
  lessons: Lesson[];
  strengths: Strengths;
  log: FighterLogEntry[];
}

export const MAX_WARD = 0.5;
export const MAX_TRAIT_GAIN = 0.25;
export const WARD_STEP = 0.05;
export const LESSON_XP = 30;
export const REINFORCE_XP = 8;
export const LOSER_STUDY_XP = 40;

export function newFighterRecord(slug: string): GeniusFighterRecord {
  const g = getGenius(slug);
  return {
    version: 1,
    slug: g.slug,
    name: g.name,
    wing: g.wing,
    xp: 0,
    level: 1,
    record: { matches: 0, wins: 0, losses: 0, draws: 0, fallaciesCommitted: 0 },
    lessons: [],
    strengths: { fallacyWards: {}, traitGains: {} },
    log: [],
  };
}

export interface BoutLearningInput {
  replay: MatchReplay;
  side: Side;
  opponentSlug: string;
  boutId: string;
  at: string;
}

export interface BoutLearning {
  record: GeniusFighterRecord;
  entry: FighterLogEntry;
  newLessons: Lesson[];
  reinforced: Lesson[];
}

/**
 * Apply one bout to a fighter's career. Pure: returns a new record.
 * Invariant (tested): nothing in the old record decreases or disappears.
 */
export function learnFromBout(prev: GeniusFighterRecord, input: BoutLearningInput): BoutLearning {
  const { replay, side, opponentSlug, boutId, at } = input;
  const rec = cloneRecord(prev);
  const opp = opponent(side);
  const oppName = safeName(opponentSlug);
  const result: BoutResult = replay.winner === side ? 'win' : replay.winner ? 'loss' : 'draw';
  const mine = replay.entries.filter((e) => e.argument.side === side);
  const theirs = replay.entries.filter((e) => e.argument.side === opp);

  const candidates: Omit<Lesson, 'seen' | 'learnedAt' | 'learnedFrom'>[] = [];

  // 1. Every fallacy I committed becomes a lesson and a ward.
  const myFallacies = mine.flatMap((e) => e.verdict.fallacies);
  for (const f of unique(myFallacies)) {
    const def = FALLACIES[f];
    candidates.push({
      id: `avoid:${f}`,
      kind: 'avoid_fallacy',
      text: `Never use ${def.label.toLowerCase()} (${def.description.replace(/\.$/, '')}). It cost you against ${oppName}.`,
      opponent: opponentSlug,
    });
    const ward = rec.strengths.fallacyWards[f] ?? 0;
    rec.strengths.fallacyWards[f] = Math.min(MAX_WARD, ward + WARD_STEP);
  }

  // 2. Every blow that hurt me becomes a counter to prepare.
  for (const e of theirs.filter(hurt)) {
    candidates.push({
      id: `counter:${hash(e.argument.text)}`,
      kind: 'counter',
      text: `Prepare an answer before you assert: ${oppName} broke through with "${excerpt(e.argument.text)}"${judgeNote(e.verdict.rationale)}.`,
      opponent: opponentSlug,
    });
  }

  // 3. Techniques: the loser studies the move that beat it; the winner
  //    keeps its own best move.
  const bestTheirs = best(theirs);
  const bestMine = best(mine);
  if (result !== 'win' && bestTheirs) {
    candidates.push({
      id: `technique:${hash(bestTheirs.argument.text)}`,
      kind: 'technique',
      text: `Borrow this pattern from ${oppName}: "${excerpt(bestTheirs.argument.text)}" — ${structureNote(bestTheirs)}.`,
      opponent: opponentSlug,
    });
  }
  if (result === 'win' && bestMine) {
    candidates.push({
      id: `technique:${hash(bestMine.argument.text)}`,
      kind: 'technique',
      text: `Your winning pattern: "${excerpt(bestMine.argument.text)}" — ${structureNote(bestMine)}.`,
      opponent: opponentSlug,
    });
  }

  // 4. A loss always teaches something, even a clean loss.
  if (result === 'loss') {
    const weakest = worst(mine);
    candidates.push({
      id: `blind:${hash(`${opponentSlug}:${weakest?.argument.text ?? replay.config.topic}`)}`,
      kind: 'blind_spot',
      text: weakest && weakest.verdict.soundness < 0.7
        ? `Your weakest move against ${oppName} was "${excerpt(weakest.argument.text)}" (soundness ${weakest.verdict.soundness.toFixed(2)}). State its premises and evidence before you use it again.`
        : weakest
          ? `Your moves against ${oppName} were sound but not enough. Answer their strongest point directly before advancing your own.`
          : `You lost to ${oppName} without landing an argument. Open with your strongest evidenced premise.`,
      opponent: opponentSlug,
    });
  }

  const newLessons: Lesson[] = [];
  const reinforced: Lesson[] = [];
  for (const c of candidates) {
    const existing = rec.lessons.find((l) => l.id === c.id);
    if (existing) {
      existing.seen += 1;
      if (!reinforced.includes(existing)) reinforced.push(existing);
    } else if (!newLessons.some((l) => l.id === c.id)) {
      const lesson: Lesson = { ...c, learnedFrom: boutId, learnedAt: at, seen: 1 };
      rec.lessons.push(lesson);
      newLessons.push(lesson);
    }
  }

  // 5. Trait gains: the loser grows toward what beat it; the winner sharpens
  //    what worked. Gains only accumulate.
  const growth = result === 'win' ? 0.005 : 0.015;
  const source = result === 'win' ? mine : theirs;
  for (const trait of traitsShownBy(source)) addTrait(rec, trait, growth);

  // 6. XP: the match award plus study XP. Losing is where the most study happens.
  const matchXp = xpForMatch(replay, side).total;
  const studyXp =
    newLessons.length * LESSON_XP + reinforced.length * REINFORCE_XP + (result === 'loss' ? LOSER_STUDY_XP : 0);
  const xpGained = matchXp + studyXp;
  rec.xp += xpGained;
  rec.level = levelForXp(rec.xp);

  rec.record.matches += 1;
  if (result === 'win') rec.record.wins += 1;
  else if (result === 'loss') rec.record.losses += 1;
  else rec.record.draws += 1;
  rec.record.fallaciesCommitted += myFallacies.length;

  const stats = replay.stats[side];
  const entry: FighterLogEntry = {
    boutId,
    at,
    opponent: opponentSlug,
    side,
    result,
    topic: replay.config.topic,
    stance: replay.config.stances[side],
    finalIntegrity: replay.finalIntegrity[side],
    opponentIntegrity: replay.finalIntegrity[opp],
    arguments: stats.arguments,
    avgSoundness: round(stats.avgSoundness),
    fallacies: myFallacies,
    ...(bestMine ? { bestMove: excerpt(bestMine.argument.text) } : {}),
    xpGained,
    lessonsGained: newLessons.map((l) => l.id),
    lessonsReinforced: reinforced.map((l) => l.id),
    levelAfter: rec.level,
  };
  rec.log.push(entry);

  return { record: rec, entry, newLessons, reinforced };
}

/** The fighter as it fights today: base wing style plus everything it has earned. */
export function grownArchetype(rec: GeniusFighterRecord): FighterArchetype {
  const base = geniusArchetype(rec.slug);
  const traits = { ...base.traits };
  for (const [k, v] of Object.entries(rec.strengths.traitGains) as [keyof StyleTraits, number][]) {
    traits[k] = Math.min(1, traits[k] + v);
  }
  const fallacyRisk = { ...base.fallacyRisk };
  for (const [f, ward] of Object.entries(rec.strengths.fallacyWards) as [FallacyId, number][]) {
    if (fallacyRisk[f] !== undefined) fallacyRisk[f] = Math.max(0, fallacyRisk[f]! * (1 - ward));
  }
  return {
    ...base,
    title: `${base.title} · Lv ${rec.level}`,
    traits,
    fallacyRisk,
  };
}

/**
 * The lessons most worth carrying into the next bout: fallacies first (most
 * reinforced first), then counters prepared for this opponent, then
 * techniques and blind spots, newest first.
 */
export function lessonsForPrompt(rec: GeniusFighterRecord, opts: { opponent?: string; limit?: number } = {}): string[] {
  const limit = opts.limit ?? 8;
  const order: LessonKind[] = ['avoid_fallacy', 'counter', 'blind_spot', 'technique'];
  const ranked = [...rec.lessons].sort((a, b) => {
    const ka = order.indexOf(a.kind);
    const kb = order.indexOf(b.kind);
    if (ka !== kb) return ka - kb;
    const oa = opts.opponent && a.opponent === opts.opponent ? 0 : 1;
    const ob = opts.opponent && b.opponent === opts.opponent ? 0 : 1;
    if (oa !== ob) return oa - ob;
    if (a.seen !== b.seen) return b.seen - a.seen;
    return b.learnedAt.localeCompare(a.learnedAt);
  });
  return ranked.slice(0, limit).map((l) => l.text);
}

export function xpToNextLevel(rec: GeniusFighterRecord): number {
  return rec.level * XP_PER_LEVEL - rec.xp;
}

/** Human-readable individual log for one fighter. */
export function renderFighterLog(rec: GeniusFighterRecord): string {
  const r = rec.record;
  const lines = [
    `# ${rec.name}`,
    '',
    `Wing: ${WINGS[rec.wing].name} · Level ${rec.level} · XP ${rec.xp} (${xpToNextLevel(rec)} to next)`,
    `Record: ${r.wins}-${r.losses}-${r.draws} in ${r.matches} bouts · fallacies committed ${r.fallaciesCommitted}`,
    '',
    `## Lessons (${rec.lessons.length})`,
    '',
  ];
  if (rec.lessons.length === 0) lines.push('None yet.');
  for (const l of rec.lessons) lines.push(`- [${l.kind}] ${l.text}${l.seen > 1 ? ` (x${l.seen})` : ''}`);
  const wards = Object.entries(rec.strengths.fallacyWards);
  const gains = Object.entries(rec.strengths.traitGains);
  lines.push('', '## Earned strengths', '');
  if (wards.length === 0 && gains.length === 0) lines.push('None yet.');
  for (const [f, w] of wards) lines.push(`- Ward vs ${f}: ${Math.round((w ?? 0) * 100)}%`);
  for (const [t, g] of gains) lines.push(`- ${t}: +${(g ?? 0).toFixed(3)}`);
  lines.push('', `## Bout log (${rec.log.length})`, '');
  if (rec.log.length === 0) lines.push('No bouts yet.');
  for (const e of [...rec.log].reverse()) {
    lines.push(
      `- ${e.at.slice(0, 10)} · ${e.result.toUpperCase()} vs ${safeName(e.opponent)} · ${e.finalIntegrity}-${e.opponentIntegrity} · +${e.xpGained} XP · Lv ${e.levelAfter}` +
        (e.lessonsGained.length ? ` · learned ${e.lessonsGained.length}` : '') +
        (e.fallacies.length ? ` · fallacies: ${e.fallacies.join(', ')}` : ''),
    );
    lines.push(`  - Topic: ${e.topic}`);
  }
  return lines.join('\n') + '\n';
}

/** Validate/upgrade a record loaded from storage; unknown data is rejected. */
export function parseFighterRecord(data: unknown): GeniusFighterRecord {
  const r = data as Partial<GeniusFighterRecord>;
  if (!r || r.version !== 1 || typeof r.slug !== 'string') throw new Error('Not a fighter record');
  const base = newFighterRecord(r.slug);
  return {
    ...base,
    ...r,
    record: { ...base.record, ...(r.record ?? {}) },
    strengths: {
      fallacyWards: { ...(r.strengths?.fallacyWards ?? {}) },
      traitGains: { ...(r.strengths?.traitGains ?? {}) },
    },
    lessons: Array.isArray(r.lessons) ? r.lessons : [],
    log: Array.isArray(r.log) ? r.log : [],
    level: levelForXp(r.xp ?? 0),
  } as GeniusFighterRecord;
}

/* ------------------------------------------------------------------ */

function cloneRecord(r: GeniusFighterRecord): GeniusFighterRecord {
  return JSON.parse(JSON.stringify(r)) as GeniusFighterRecord;
}

function hurt(e: TranscriptEntry): boolean {
  return e.combat.some((c) => c.type === 'launcher' || c.type === 'finisher' || c.damage >= 10);
}

function score(e: TranscriptEntry): number {
  return e.verdict.soundness + e.verdict.evidence * 0.5 + e.verdict.rebuttalForce + e.combat.reduce((s, c) => s + c.damage, 0) / 20;
}

function best(entries: TranscriptEntry[]): TranscriptEntry | undefined {
  const clean = entries.filter((e) => e.verdict.fallacies.length === 0 && e.combat.some((c) => c.damage > 0));
  return [...clean].sort((a, b) => score(b) - score(a))[0];
}

function worst(entries: TranscriptEntry[]): TranscriptEntry | undefined {
  return [...entries].sort((a, b) => score(a) - score(b))[0];
}

function structureNote(e: TranscriptEntry): string {
  const v = e.verdict;
  const parts: string[] = [];
  if (v.rebuttalForce >= 0.6) parts.push('it answered the opponent directly');
  if (v.evidence >= 0.6) parts.push('it carried evidence');
  if (v.structure >= 0.6 || v.soundness >= 0.75) parts.push('its premises led cleanly to the conclusion');
  return parts.length ? parts.join(', ') : 'it stayed clean and on topic';
}

function traitsShownBy(entries: TranscriptEntry[]): (keyof StyleTraits)[] {
  const clean = entries.filter((e) => e.verdict.fallacies.length === 0);
  if (clean.length === 0) return ['patience'];
  const avg = (f: (e: TranscriptEntry) => number) => clean.reduce((s, e) => s + f(e), 0) / clean.length;
  const out: (keyof StyleTraits)[] = [];
  if (avg((e) => e.verdict.evidence) >= 0.55) out.push('empiricism');
  if (avg((e) => e.verdict.structure) >= 0.55 || avg((e) => e.verdict.soundness) >= 0.75) out.push('formalism');
  if (avg((e) => e.verdict.rebuttalForce) >= 0.4) out.push('interrogation');
  if (clean.some((e) => e.combat.some((c) => c.combo > 1))) out.push('patience');
  return out.length ? out : ['patience'];
}

function addTrait(rec: GeniusFighterRecord, trait: keyof StyleTraits, amount: number): void {
  const cur = rec.strengths.traitGains[trait] ?? 0;
  rec.strengths.traitGains[trait] = round(Math.min(MAX_TRAIT_GAIN, cur + amount), 4);
}

/** Judge rationale worth carrying into a lesson (scripted fixtures' bookkeeping is dropped). */
function judgeNote(rationale: string): string {
  const r = rationale.trim();
  if (!r || /^authored ground truth/i.test(r)) return '';
  return ` (${r.replace(/\.$/, '')})`;
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function excerpt(text: string, n = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function round(x: number, d = 3): number {
  const m = 10 ** d;
  return Math.round(x * m) / m;
}

function safeName(slug: string): string {
  try {
    return getGenius(slug).name;
  } catch {
    return slug;
  }
}
