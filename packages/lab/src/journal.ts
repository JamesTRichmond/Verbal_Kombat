/**
 * DecisionJournal — closes the calibration loop.
 *
 * Record decisions when they are made; later, mark which predicted
 * outcomes actually happened. Brier scores per seat measure how honest each
 * lens's probabilities were, and credibilityPriors() feeds that back into
 * runDecision so well-calibrated seats start the next council with more
 * benefit of the doubt.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DecisionRecord } from './decision.js';

export interface OutcomeResolution {
  seat: string;
  outcomeIndex: number;
  happened: boolean;
  resolvedAt: string;
}

export interface JournalEntry {
  record: DecisionRecord;
  resolutions: OutcomeResolution[];
}

export interface JournalData {
  version: 1;
  entries: JournalEntry[];
}

export interface BrierScore {
  brier: number;
  /** Number of resolved predictions behind the score. */
  n: number;
}

export class DecisionJournal {
  private readonly entries: JournalEntry[] = [];

  constructor(data?: JournalData) {
    for (const e of data?.entries ?? []) this.entries.push({ record: e.record, resolutions: [...e.resolutions] });
  }

  static load(path: string): DecisionJournal {
    if (!existsSync(path)) return new DecisionJournal();
    const data = JSON.parse(readFileSync(path, 'utf8')) as JournalData;
    if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error(`Not a decision journal: ${path}`);
    return new DecisionJournal(data);
  }

  save(path: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(this.toJSON(), null, 2) + '\n', 'utf8');
  }

  toJSON(): JournalData {
    return { version: 1, entries: this.entries.map((e) => ({ record: e.record, resolutions: [...e.resolutions] })) };
  }

  add(record: DecisionRecord): void {
    if (this.entries.some((e) => e.record.id === record.id)) {
      throw new Error(`Journal already has a record with id ${record.id}`);
    }
    this.entries.push({ record, resolutions: [] });
  }

  get(recordId: string): JournalEntry | undefined {
    return this.entries.find((e) => e.record.id === recordId);
  }

  list(): DecisionRecord[] {
    return this.entries.map((e) => e.record);
  }

  /** Mark whether a predicted outcome happened. Re-resolving replaces the earlier answer. */
  resolveOutcome(recordId: string, seat: string, outcomeIndex: number, happened: boolean, now: Date = new Date()): void {
    const entry = this.get(recordId);
    if (!entry) throw new Error(`No journal record ${recordId}`);
    const exists = entry.record.predictions.some((p) => p.seat === seat && p.outcomeIndex === outcomeIndex);
    if (!exists) throw new Error(`Record ${recordId} has no prediction ${seat}#${outcomeIndex}`);
    const i = entry.resolutions.findIndex((r) => r.seat === seat && r.outcomeIndex === outcomeIndex);
    const resolution: OutcomeResolution = { seat, outcomeIndex, happened, resolvedAt: now.toISOString() };
    if (i >= 0) entry.resolutions[i] = resolution;
    else entry.resolutions.push(resolution);
  }

  /** Predictions not yet resolved, across all records. */
  pending(): { recordId: string; seat: string; outcomeIndex: number; description: string }[] {
    return this.entries.flatMap((e) =>
      e.record.predictions
        .filter((p) => !e.resolutions.some((r) => r.seat === p.seat && r.outcomeIndex === p.outcomeIndex))
        .map((p) => ({ recordId: e.record.id, seat: p.seat, outcomeIndex: p.outcomeIndex, description: p.description })),
    );
  }

  /** Mean squared error of claimed probability vs. what happened, per seat. Lower is better. */
  brierScores(): Record<string, BrierScore> {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const e of this.entries) {
      for (const r of e.resolutions) {
        const p = e.record.predictions.find((x) => x.seat === r.seat && x.outcomeIndex === r.outcomeIndex);
        if (!p) continue;
        const prob = Math.min(1, Math.max(0, p.probability));
        const err = (prob - (r.happened ? 1 : 0)) ** 2;
        const a = acc.get(r.seat) ?? { sum: 0, n: 0 };
        a.sum += err;
        a.n += 1;
        acc.set(r.seat, a);
      }
    }
    return Object.fromEntries(
      [...acc.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([seat, a]) => [seat, { brier: a.sum / a.n, n: a.n }]),
    );
  }

  /** Brier → 0..1 prior (1 − brier, clamped). Only seats with resolved predictions appear. */
  credibilityPriors(): Record<string, number> {
    return Object.fromEntries(
      Object.entries(this.brierScores()).map(([seat, s]) => [seat, Math.min(1, Math.max(0, 1 - s.brier))]),
    );
  }
}
