import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GENIUSES, newFighterRecord, type GeniusFighterRecord } from '@vk/core';
import { FileFighterStore, GrowthRegressionError, rankFighters } from './roster-store.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vk-roster-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function grown(slug: string, xp: number): GeniusFighterRecord {
  const r = newFighterRecord(slug);
  r.xp = xp;
  r.record.matches = 1;
  r.record.wins = 1;
  r.lessons.push({ id: 'avoid:strawman', kind: 'avoid_fallacy', text: 'Never strawman.', learnedFrom: 'b1', learnedAt: '2026-01-01T00:00:00.000Z', seen: 1 });
  r.log.push({
    boutId: 'b1', at: '2026-01-01T00:00:00.000Z', opponent: 'plato', side: 'A', result: 'win', topic: 't', stance: 's',
    finalIntegrity: 90, opponentIntegrity: 0, arguments: 3, avgSoundness: 0.8, fallacies: [], xpGained: xp,
    lessonsGained: ['avoid:strawman'], lessonsReinforced: [], levelAfter: 1,
  });
  return r;
}

describe('FileFighterStore', () => {
  it('returns a fresh record for missing fighters and round-trips a career', () => {
    const store = new FileFighterStore(dir);
    expect(store.get('socrates')).toEqual(newFighterRecord('socrates'));
    const rec = grown('socrates', 1500);
    store.put(rec);
    const back = store.get('socrates');
    expect(back.xp).toBe(1500);
    expect(back.level).toBe(2);
    expect(back.lessons).toEqual(rec.lessons);
    expect(back.log).toEqual(rec.log);
    expect(readFileSync(join(dir, 'socrates.json'), 'utf8')).toMatch(/^\{\n {2}"version": 1/);
    expect(readFileSync(join(dir, 'socrates.md'), 'utf8')).toMatch(/Level 2 · XP 1500/);
  });

  it('ensureAll creates all 186 without overwriting existing careers', () => {
    const store = new FileFighterStore(dir);
    store.put(grown('plato', 700));
    expect(store.ensureAll()).toBe(GENIUSES.length - 1);
    expect(store.get('plato').xp).toBe(700);
    expect(store.ensureAll()).toBe(0);
    expect(store.all()).toHaveLength(186);
    for (const g of GENIUSES) {
      expect(existsSync(join(dir, `${g.slug}.json`))).toBe(true);
      expect(existsSync(join(dir, `${g.slug}.md`))).toBe(true);
    }
    const index = readFileSync(store.writeIndex(), 'utf8');
    expect(index.split('\n').filter((l) => /^\| \d+ \|/.test(l))).toHaveLength(186);
    expect(index).toMatch(/\| 1 \| \[Plato\]\(plato\.md\) \|/);
  });

  it('refuses to write a regression', () => {
    const store = new FileFighterStore(dir);
    store.put(grown('kant', 900));
    expect(() => store.put(newFighterRecord('kant'))).toThrow(GrowthRegressionError);

    const fewerLessons = grown('kant', 950);
    fewerLessons.lessons = [];
    expect(() => store.put(fewerLessons)).toThrow(/lesson/);

    const shorterLog = grown('kant', 950);
    shorterLog.log = [];
    expect(() => store.put(shorterLog)).toThrow(/bout log/);

    const swapped = grown('kant', 950);
    swapped.lessons = [{ ...swapped.lessons[0]!, id: 'avoid:ad_hominem' }];
    expect(() => store.put(swapped)).toThrow(/would be removed/);

    expect(store.get('kant').xp).toBe(900);
    store.put(grown('kant', 950));
    expect(store.get('kant').xp).toBe(950);
  });

  it('rejects unsafe slugs and loads a hand-edited file through the parser', () => {
    const store = new FileFighterStore(dir);
    expect(() => store.get('../etc')).toThrow(/Invalid fighter slug/);
    writeFileSync(join(dir, 'hypatia.json'), JSON.stringify({ version: 1, slug: 'hypatia', xp: 2100 }), 'utf8');
    const r = store.get('hypatia');
    expect(r.level).toBe(3);
    expect(r.lessons).toEqual([]);
  });

  it('ranks by level, then xp, then wins', () => {
    const a = grown('plato', 500);
    const b = grown('kant', 500);
    b.record.wins = 3;
    const c = grown('rumi', 1200);
    expect(rankFighters([a, b, c]).map((r) => r.slug)).toEqual(['rumi', 'kant', 'plato']);
  });
});
