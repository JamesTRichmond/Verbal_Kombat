import { describe, expect, it } from 'vitest';
import { HeuristicJudge } from '@vk/judge';
import { MemoryFighterStore } from '@vk/replay';
import { benchmarkAgents, renderScorecards, resolveArchetype } from './arena.js';
import { MockChatClient } from './mock-client.js';

const topics = [
  { topic: 'Should cities ban cars downtown?', stances: { A: 'Car-free downtowns help business', B: 'Car bans hurt downtown business' } },
  { topic: 'Is homework useful?', stances: { A: 'Homework builds mastery', B: 'Homework adds little' } },
];

function run() {
  return benchmarkAgents({
    entrants: [
      { id: 'good', client: new MockChatClient({ seed: 1, personality: 'good' }), archetypeId: 'the_formalist' },
      { id: 'sloppy', client: new MockChatClient({ seed: 2, personality: 'sloppy', fallacyRate: 0.8 }) },
      { id: 'genius:socrates', client: new MockChatClient({ seed: 3, personality: 'good', fallacyRate: 0.2 }) },
    ],
    topics,
    judge: new HeuristicJudge(),
    maxTurns: 3,
  });
}

describe('benchmarkAgents', () => {
  it('ranks the disciplined agent above the sloppy one', async () => {
    const { scorecards, matches } = await run();
    // 3 pairs × 2 topics × 2 side assignments
    expect(matches.length).toBe(12);
    const good = scorecards.find((c) => c.id === 'good')!;
    const sloppy = scorecards.find((c) => c.id === 'sloppy')!;
    expect(good.matches).toBe(8);
    expect(good.winRate).toBeGreaterThan(sloppy.winRate);
    expect(good.fallacyRate).toBeLessThan(sloppy.fallacyRate);
    expect(good.avgSoundness).toBeGreaterThan(sloppy.avgSoundness);
    expect(good.avgReward).toBeGreaterThan(sloppy.avgReward);
    expect(good.elo).toBeGreaterThan(sloppy.elo);
    expect(scorecards.at(-1)!.id).toBe('sloppy');
    // Every pair plays both sides of every topic.
    expect(matches.filter((m) => m.A === 'good' && m.B === 'sloppy').length).toBe(2);
    expect(matches.filter((m) => m.A === 'sloppy' && m.B === 'good').length).toBe(2);
    expect(renderScorecards(scorecards)).toMatch(/^entrant/);
  });

  it('is deterministic', async () => {
    const a = await run();
    const b = await run();
    expect(a.scorecards).toEqual(b.scorecards);
    expect(a.matches.map((m) => [m.id, m.winner])).toEqual(b.matches.map((m) => [m.id, m.winner]));
  });

  it('resolves roster and genius archetypes', () => {
    expect(resolveArchetype({ id: 'x', archetypeId: 'silver_tongue' }).id).toBe('silver_tongue');
    expect(resolveArchetype({ id: 'genius:socrates' }).id).toBe('genius:socrates');
    expect(resolveArchetype({ id: 'plain' }).id).toBe('socrates_prime');
    expect(() => resolveArchetype({ id: 'x', archetypeId: 'nope' })).toThrow();
  });

  it('persists growth for genius entrants only when given a store', async () => {
    const store = new MemoryFighterStore();
    const run2 = () =>
      benchmarkAgents({
        entrants: [
          { id: 'socrates-bot', archetypeId: 'genius:socrates', client: new MockChatClient({ seed: 3, fallacyRate: 0.5 }) },
          { id: 'plain', client: new MockChatClient({ seed: 4, personality: 'good' }) },
        ],
        topics,
        judge: new HeuristicJudge(),
        maxTurns: 3,
        fighters: store,
        now: () => new Date('2026-09-16T00:00:00Z'),
      });
    await run2();
    expect([...store.records.keys()]).toEqual(['socrates']);
    const first = store.get('socrates');
    expect(first.log).toHaveLength(4);
    expect(first.log.every((e) => e.opponent === 'plain')).toBe(true);
    expect(first.xp).toBeGreaterThan(0);
    expect(first.lessons.length).toBeGreaterThan(0);
    await run2();
    const second = store.get('socrates');
    expect(second.log).toHaveLength(8);
    expect(second.xp).toBeGreaterThan(first.xp);
    expect(second.log.slice(0, 4)).toEqual(first.log);

    // Same genius on both sides still only grows.
    const self = new MemoryFighterStore();
    await benchmarkAgents({
      entrants: [
        { id: 'genius:plato', client: new MockChatClient({ seed: 1 }) },
        { id: 'plato-2', archetypeId: 'genius:plato', client: new MockChatClient({ seed: 2, fallacyRate: 0.6 }) },
      ],
      topics: topics.slice(0, 1),
      judge: new HeuristicJudge(),
      fighters: self,
    });
    expect(self.get('plato').log).toHaveLength(4);
  });
});
