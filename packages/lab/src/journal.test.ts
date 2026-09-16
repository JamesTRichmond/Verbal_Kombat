import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DecisionRecord } from './decision.js';
import { DecisionJournal } from './journal.js';

function record(id: string): DecisionRecord {
  return {
    id,
    timestamp: '2026-01-01T00:00:00.000Z',
    problem: 'p',
    mode: 'quick',
    profile: { ownerId: 'o', ownerName: 'O', criteria: [{ id: 'x', label: 'x', weight: 1 }] },
    seats: [],
    proposals: [],
    statusQuo: { seat: 'status-quo', answer: '', reasoning: '', outcomes: [] },
    standings: [],
    baseline: { claimedEV: 0, calibratedEV: 0 },
    champion: { seat: 'a', answer: '', calibratedEV: 0 },
    beatsStatusQuo: true,
    fightsChangedTheAnswer: false,
    bouts: [],
    sensitivity: [],
    predictions: [
      { seat: 'a', outcomeIndex: 0, description: 'a0', probability: 0.9, matters: 0 },
      { seat: 'a', outcomeIndex: 1, description: 'a1', probability: 0.1, matters: 0 },
      { seat: 'b', outcomeIndex: 0, description: 'b0', probability: 0.9, matters: 0 },
    ],
  };
}

describe('DecisionJournal', () => {
  it('Brier-scores seats and maps them to priors', () => {
    const j = new DecisionJournal();
    j.add(record('r1'));
    j.resolveOutcome('r1', 'a', 0, true); // (0.9-1)^2 = 0.01
    j.resolveOutcome('r1', 'a', 1, false); // (0.1-0)^2 = 0.01
    j.resolveOutcome('r1', 'b', 0, true);
    j.resolveOutcome('r1', 'b', 0, false); // re-resolve replaces: (0.9-0)^2 = 0.81
    const s = j.brierScores();
    expect(s.a!.brier).toBeCloseTo(0.01, 10);
    expect(s.a!.n).toBe(2);
    expect(s.b!.brier).toBeCloseTo(0.81, 10);
    expect(s.b!.n).toBe(1);
    const priors = j.credibilityPriors();
    expect(priors.a).toBeCloseTo(0.99, 10);
    expect(priors.b).toBeCloseTo(0.19, 10);
    expect(j.pending()).toEqual([]);
  });

  it('rejects unknown records, predictions and duplicate ids', () => {
    const j = new DecisionJournal();
    j.add(record('r1'));
    expect(() => j.add(record('r1'))).toThrow();
    expect(() => j.resolveOutcome('nope', 'a', 0, true)).toThrow();
    expect(() => j.resolveOutcome('r1', 'a', 9, true)).toThrow();
    expect(j.pending().length).toBe(3);
  });

  it('round-trips through JSON on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-journal-'));
    try {
      const path = join(dir, 'nested', 'journal.json');
      expect(DecisionJournal.load(path).list()).toEqual([]);
      const j = new DecisionJournal();
      j.add(record('r1'));
      j.resolveOutcome('r1', 'a', 0, true);
      j.save(path);
      const back = DecisionJournal.load(path);
      expect(back.list()).toEqual([record('r1')]);
      expect(back.brierScores()).toEqual(j.brierScores());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
