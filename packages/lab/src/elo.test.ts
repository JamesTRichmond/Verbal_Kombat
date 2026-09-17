import { describe, expect, it } from 'vitest';
import { Ladder, expectedScore, updateElo } from './elo.js';

describe('elo', () => {
  it('expected score is 0.5 for equal ratings and ~0.76 at +200', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1700, 1500)).toBeCloseTo(0.7597, 4);
    expect(expectedScore(1700, 1500) + expectedScore(1500, 1700)).toBeCloseTo(1, 10);
  });

  it('updates are zero-sum and scale with K', () => {
    const { a, b } = updateElo(1500, 1500, 1, 32);
    expect(a).toBe(1516);
    expect(b).toBe(1484);
    const draw = updateElo(1600, 1400, 0.5, 20);
    expect(draw.a).toBeLessThan(1600);
    expect(draw.a + draw.b).toBeCloseTo(3000, 10);
  });

  it('ladder records results and sorts standings deterministically', () => {
    const ladder = new Ladder({ k: 32 });
    ladder.add('zed');
    ladder.add('amy');
    expect(ladder.standings().map((r) => r.id)).toEqual(['amy', 'zed']);
    ladder.record('zed', 'amy', 'zed');
    ladder.record('zed', 'amy', null);
    const [top, bottom] = ladder.standings();
    expect(top).toMatchObject({ id: 'zed', wins: 1, draws: 1, games: 2 });
    expect(bottom).toMatchObject({ id: 'amy', losses: 1, draws: 1 });
    expect(top!.rating + bottom!.rating).toBeCloseTo(2000, 10);
    expect(() => ladder.record('zed', 'amy', 'bob')).toThrow();
  });
});
