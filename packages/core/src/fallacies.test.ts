import { describe, expect, it } from 'vitest';
import { FALLACIES, type FallacyId } from './fallacies.js';

describe('fallacy taxonomy', () => {
  it('every entry key matches its id', () => {
    for (const [key, def] of Object.entries(FALLACIES)) {
      expect(def.id).toBe(key);
    }
  });

  it('failure modes and backfire damage stay consistent', () => {
    for (const def of Object.values(FALLACIES)) {
      expect(['whiff', 'labeled_block', 'backfire']).toContain(def.failureMode);
      expect(def.backfireDamage).toBeGreaterThanOrEqual(0);
      // Self-damage is the signature of a backfire and nothing else.
      if (def.failureMode === 'backfire') {
        expect(def.backfireDamage).toBeGreaterThan(0);
      } else {
        expect(def.backfireDamage).toBe(0);
      }
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('includes the ported fallacies with expected combat semantics', () => {
    const expected: Record<string, string> = {
      no_true_scotsman: 'labeled_block',
      appeal_to_ignorance: 'whiff',
      false_cause: 'whiff',
    };
    for (const [id, mode] of Object.entries(expected)) {
      const def = FALLACIES[id as FallacyId];
      expect(def, `missing fallacy: ${id}`).toBeDefined();
      expect(def.failureMode).toBe(mode);
    }
  });
});
