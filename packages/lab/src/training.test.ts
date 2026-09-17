import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GENIUSES, type GeniusFighterRecord } from '@vk/core';
import { HeuristicJudge } from '@vk/judge';
import { MemoryFighterStore } from '@vk/replay';
import { MockChatClient } from './mock-client.js';
import { FileFighterStore } from './roster-store.js';
import { trainingCamp, type Pairing } from './training.js';

const topics = [
  { topic: 'Is homework useful?', stances: { A: 'Homework builds mastery', B: 'Homework adds little' } },
  { topic: 'Should cities ban cars downtown?', stances: { A: 'Car-free downtowns help', B: 'Car bans hurt downtowns' } },
];

function camp(store: MemoryFighterStore | FileFighterStore, bouts: number, pairing: Pairing = 'random', seed = 5) {
  return trainingCamp({
    store,
    bouts,
    seed,
    pairing,
    topics,
    judge: new HeuristicJudge(),
    clientFor: (slug, boutId) =>
      new MockChatClient({ seed: slug.length * 31 + boutId.length, personality: 'good', fallacyRate: slug.length % 2 ? 0.5 : 0.1 }),
    now: () => new Date('2026-09-16T00:00:00Z'),
  });
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vk-train-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('trainingCamp', () => {
  it('runs bouts, grows participants, and never reduces anything', async () => {
    const store = new FileFighterStore(dir);
    store.ensureAll();
    const before = new Map<string, GeniusFighterRecord>(store.all().map((r) => [r.slug, r]));
    const bouts: string[] = [];
    const summary = await trainingCamp({
      store,
      bouts: 10,
      seed: 9,
      topics,
      judge: new HeuristicJudge(),
      clientFor: (slug, boutId) => new MockChatClient({ seed: slug.length + boutId.length, fallacyRate: 0.4 }),
      now: () => new Date('2026-09-16T00:00:00Z'),
      onBout: (b) => void bouts.push(b.id),
    });
    expect(summary.bouts).toBe(10);
    expect(bouts).toHaveLength(10);
    expect(summary.fighters.length).toBeGreaterThanOrEqual(2);
    expect(summary.xpGained).toBeGreaterThan(0);
    expect(summary.lessonsGained).toBeGreaterThan(0);

    const totalLog = store.all().reduce((n, r) => n + r.log.length, 0);
    expect(totalLog).toBe(20);
    for (const f of summary.fighters) {
      const rec = store.get(f.slug);
      expect(rec.log.length).toBe(f.bouts);
      expect(rec.xp).toBe(f.xpGained);
      expect(rec.lessons.length).toBe(f.lessonsGained);
      expect(rec.level).toBe(f.levelAfter);
      // The loser always learns.
      for (const e of rec.log.filter((x) => x.result === 'loss')) expect(e.lessonsGained.length + e.lessonsReinforced.length).toBeGreaterThan(0);
    }
    for (const after of store.all()) {
      const prev = before.get(after.slug)!;
      expect(after.xp).toBeGreaterThanOrEqual(prev.xp);
      expect(after.log.length).toBeGreaterThanOrEqual(prev.log.length);
      expect(after.lessons.length).toBeGreaterThanOrEqual(prev.lessons.length);
    }

    // A second camp on top only adds.
    const mid = new Map(store.all().map((r) => [r.slug, r]));
    await camp(store, 10, 'wing-rivals', 10);
    for (const after of store.all()) {
      const prev = mid.get(after.slug)!;
      expect(after.xp).toBeGreaterThanOrEqual(prev.xp);
      for (const l of prev.lessons) {
        const kept = after.lessons.find((x) => x.id === l.id);
        expect(kept?.text).toBe(l.text);
        expect(kept!.seen).toBeGreaterThanOrEqual(l.seen);
      }
      expect(after.log.slice(0, prev.log.length)).toEqual(prev.log);
    }
  });

  it('is deterministic for a seed', async () => {
    const a = new MemoryFighterStore();
    const b = new MemoryFighterStore();
    const sa = await camp(a, 8);
    const sb = await camp(b, 8);
    expect(sa).toEqual(sb);
    expect([...a.records.values()]).toEqual([...b.records.values()]);
  });

  it('supports every pairing', async () => {
    const wings = new Map(GENIUSES.map((g) => [g.slug, g.wing]));
    const store = new MemoryFighterStore();
    const seen: [string, string][] = [];
    await trainingCamp({
      store,
      bouts: 6,
      seed: 3,
      pairing: 'wing-rivals',
      topics,
      judge: new HeuristicJudge(),
      clientFor: () => new MockChatClient(),
      onBout: (b) => void seen.push([b.A, b.B]),
    });
    for (const [x, y] of seen) expect(wings.get(x)).not.toBe(wings.get(y));
    const s = await camp(new MemoryFighterStore(), 6, 'weakest-vs-strongest');
    expect(s.bouts).toBe(6);
    await expect(camp(new MemoryFighterStore(), 1, 'nope' as Pairing)).rejects.toThrow(/Unknown pairing/);
  });
});

describe('least-fought pairing', () => {
  it('spreads bouts evenly so every fighter fights', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { FileFighterStore } = await import('./roster-store.js');
    const { trainingCamp } = await import('./training.js');
    const { MockChatClient } = await import('./mock-client.js');
    const { HeuristicJudge } = await import('@vk/judge');
    const { GENIUSES } = await import('@vk/core');
    const store = new FileFighterStore(mkdtempSync(join(tmpdir(), 'vk-least-')));
    const pool = GENIUSES.slice(0, 10);
    await trainingCamp({
      store, pool, bouts: 10, seed: 3, pairing: 'least-fought', judge: new HeuristicJudge(),
      clientFor: (slug) => new MockChatClient({ seed: slug.length }),
      topics: [{ topic: 'Is homework useful?', stances: { A: 'Yes', B: 'No' } }],
      now: () => new Date('2026-09-17T00:00:00Z'),
    });
    const counts = pool.map((g) => store.get(g.slug).record.matches);
    expect(Math.min(...counts)).toBe(2);
    expect(Math.max(...counts)).toBe(2);
  });
});
