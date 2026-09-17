import { describe, expect, it } from 'vitest';
import {
  GENIUSES,
  grownArchetype,
  geniusArchetype,
  learnFromBout,
  lessonsForPrompt,
  newFighterRecord,
  parseFighterRecord,
  renderFighterLog,
  type GeniusFighterRecord,
  type MatchReplay,
  type TranscriptEntry,
} from './index.js';

function entry(side: 'A' | 'B', n: number, text: string, v: Partial<TranscriptEntry['verdict']>, dmg: number, type = 'jab'): TranscriptEntry {
  const id = `b-a${n}`;
  return {
    argument: { id, matchId: 'b', side, text, seq: n, t: n * 1000 },
    verdict: {
      argumentId: id, side, soundness: 0.8, relevance: 0.8, evidence: 0.7, structure: 0.7,
      fallacies: [], rebuttalForce: 0, rationale: 'clean', ...v,
    },
    combat: [{ id: `c${n}`, matchId: 'b', type: type as 'jab', actor: side, damage: dmg, selfDamage: 0, combo: 1, sourceArgumentId: id, t: n * 1000 }],
  };
}

/** A beats B: B strawmans and eats a launcher. */
function bout(): MatchReplay {
  const entries = [
    entry('A', 1, 'Every claim needs a definition first; define progress before measuring it.', {}, 10),
    entry('B', 2, 'So you claim we should never ship anything at all.', { fallacies: ['strawman'], soundness: 0.1 }, 0, 'labeled_block'),
    entry('A', 3, 'Nobody said never ship; the data from ten launches shows scoped releases outperform.', { rebuttalForce: 0.9, evidence: 0.9 }, 16, 'launcher'),
    entry('B', 4, 'Momentum matters more than definitions.', { soundness: 0.4, evidence: 0.2 }, 3),
  ];
  const stat = (side: 'A' | 'B') => {
    const own = entries.filter((e) => e.argument.side === side);
    return {
      arguments: own.length,
      cleanHits: own.filter((e) => e.combat.some((c) => c.damage > 0)).length,
      fallacies: own.reduce((s, e) => s + e.verdict.fallacies.length, 0),
      avgSoundness: own.reduce((s, e) => s + e.verdict.soundness, 0) / own.length,
      totalDamageDealt: own.reduce((s, e) => s + e.combat[0]!.damage, 0),
    };
  };
  return {
    config: { id: 'b', topic: 'Ship now?', stances: { A: 'Define first', B: 'Ship now' }, fighters: { A: 'genius:socrates', B: 'genius:sun-tzu' }, mode: 'problem' },
    entries,
    winner: 'A',
    finalIntegrity: { A: 97, B: 0 },
    stats: { A: stat('A'), B: stat('B') },
  };
}

const AT = '2026-09-17T00:00:00.000Z';

function noLoss(before: GeniusFighterRecord, after: GeniusFighterRecord): void {
  expect(after.xp).toBeGreaterThanOrEqual(before.xp);
  expect(after.log.length).toBeGreaterThanOrEqual(before.log.length);
  for (const l of before.lessons) {
    const kept = after.lessons.find((x) => x.id === l.id);
    expect(kept).toBeDefined();
    expect(kept!.text).toBe(l.text);
    expect(kept!.seen).toBeGreaterThanOrEqual(l.seen);
  }
  for (const [k, v] of Object.entries(before.strengths.fallacyWards)) {
    expect(after.strengths.fallacyWards[k as 'strawman']!).toBeGreaterThanOrEqual(v!);
  }
  for (const [k, v] of Object.entries(before.strengths.traitGains)) {
    expect(after.strengths.traitGains[k as 'patience']!).toBeGreaterThanOrEqual(v!);
  }
}

describe('fighter growth', () => {
  it('every one of the 186 geniuses can hold a career', () => {
    for (const g of GENIUSES) expect(newFighterRecord(g.slug).level).toBe(1);
  });

  it('the loser learns from its fallacy, the blow that broke it, and the move that beat it', () => {
    const r = learnFromBout(newFighterRecord('sun-tzu'), { replay: bout(), side: 'B', opponentSlug: 'socrates', boutId: 'b', at: AT });
    const kinds = [...new Set(r.newLessons.map((l) => l.kind))].sort();
    expect(kinds).toEqual(['avoid_fallacy', 'blind_spot', 'counter', 'technique']);
    // Both blows that hurt (the 10-damage opener and the launcher) become counters.
    expect(r.newLessons.filter((l) => l.kind === 'counter')).toHaveLength(2);
    expect(r.record.strengths.fallacyWards.strawman).toBeGreaterThan(0);
    expect(r.entry.result).toBe('loss');
    expect(r.record.record.losses).toBe(1);
    expect(r.record.log).toHaveLength(1);
  });

  it('the loser earns study XP, so losing still moves it forward', () => {
    const loser = learnFromBout(newFighterRecord('sun-tzu'), { replay: bout(), side: 'B', opponentSlug: 'socrates', boutId: 'b', at: AT });
    expect(loser.entry.xpGained).toBeGreaterThan(100);
  });

  it('the winner also learns, but keeps its own winning pattern', () => {
    const w = learnFromBout(newFighterRecord('socrates'), { replay: bout(), side: 'A', opponentSlug: 'sun-tzu', boutId: 'b', at: AT });
    expect(w.newLessons.map((l) => l.kind)).toEqual(['technique']);
    expect(w.entry.result).toBe('win');
  });

  it('learning is additive: repeating a bout reinforces, never removes or rewrites', () => {
    let rec = newFighterRecord('sun-tzu');
    for (let i = 0; i < 5; i++) {
      const next = learnFromBout(rec, { replay: bout(), side: 'B', opponentSlug: 'socrates', boutId: `b${i}`, at: AT }).record;
      noLoss(rec, next);
      rec = next;
    }
    expect(rec.lessons.find((l) => l.id === 'avoid:strawman')!.seen).toBe(5);
    expect(rec.lessons).toHaveLength(5);
    expect(rec.log).toHaveLength(5);
    expect(rec.strengths.fallacyWards.strawman).toBeCloseTo(0.25);
  });

  it('does not mutate the record it was given', () => {
    const rec = newFighterRecord('sun-tzu');
    learnFromBout(rec, { replay: bout(), side: 'B', opponentSlug: 'socrates', boutId: 'b', at: AT });
    expect(rec.lessons).toHaveLength(0);
    expect(rec.xp).toBe(0);
  });

  it('a grown fighter argues differently: stronger traits, lower fallacy risk, lessons in its prompt', () => {
    let rec = newFighterRecord('sun-tzu');
    for (let i = 0; i < 3; i++) rec = learnFromBout(rec, { replay: bout(), side: 'B', opponentSlug: 'socrates', boutId: `b${i}`, at: AT }).record;
    const base = geniusArchetype('sun-tzu');
    const grown = grownArchetype(rec);
    expect(grown.traits.empiricism).toBeGreaterThan(base.traits.empiricism);
    expect(grown.fallacyRisk.strawman!).toBeLessThan(base.fallacyRisk.strawman!);
    const prompt = lessonsForPrompt(rec, { opponent: 'socrates' });
    expect(prompt[0]).toMatch(/strawman/);
  });

  it('round-trips through storage and renders an individual log', () => {
    const rec = learnFromBout(newFighterRecord('sun-tzu'), { replay: bout(), side: 'B', opponentSlug: 'socrates', boutId: 'b', at: AT }).record;
    const back = parseFighterRecord(JSON.parse(JSON.stringify(rec)));
    expect(back).toEqual(rec);
    const md = renderFighterLog(back);
    expect(md).toMatch(/# Sun Tzu/);
    expect(md).toMatch(/LOSS vs Socrates/);
    expect(() => parseFighterRecord({ nope: true })).toThrow();
  });
});
