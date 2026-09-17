/**
 * Careers: every genius fighter's persistent record, kept in localStorage.
 *
 * One JSON object under `vk.fighters.v1`, keyed by slug. Records are created
 * lazily (newFighterRecord) the first time a fighter is asked for. Growth is
 * additive, so a write that would lose XP, log entries, or lessons is refused.
 * When storage is unavailable (private mode, blocked site data) the store
 * keeps working in memory for the session.
 */

import {
  GENIUSES,
  learnFromBout,
  newFighterRecord,
  parseFighterRecord,
  type BoutLearning,
  type GeniusFighterRecord,
  type MatchReplay,
  type Side,
} from '@vk/core';
import type { FighterStore } from '@vk/replay';

export const CAREERS_KEY = 'vk.fighters.v1';

type RecordMap = Record<string, GeniusFighterRecord>;

function readStorage(): RecordMap | null {
  try {
    const raw = window.localStorage.getItem(CAREERS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') return {};
    return parseMap(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

function parseMap(data: Record<string, unknown>): RecordMap {
  const out: RecordMap = {};
  for (const [slug, value] of Object.entries(data)) {
    try {
      const rec = parseFighterRecord(value);
      if (rec.slug === slug) out[slug] = rec;
    } catch {
      /* unknown or corrupt entry: skip it */
    }
  }
  return out;
}

/** True when `next` would lose something `prev` has. */
export function isRegression(prev: GeniusFighterRecord, next: GeniusFighterRecord): boolean {
  return next.xp < prev.xp || next.log.length < prev.log.length || next.lessons.length < prev.lessons.length;
}

export class BrowserFighterStore implements FighterStore {
  private records: RecordMap = {};
  private persistent = true;

  constructor() {
    const loaded = readStorage();
    if (loaded === null) this.persistent = false;
    else this.records = loaded;
  }

  /** False when the browser refused storage and careers live only in memory. */
  get saved(): boolean {
    return this.persistent;
  }

  get(slug: string): GeniusFighterRecord {
    return this.records[slug] ?? newFighterRecord(slug);
  }

  /** Records that have fought at least once. */
  all(): GeniusFighterRecord[] {
    return Object.values(this.records);
  }

  put(record: GeniusFighterRecord): void {
    const prev = this.records[record.slug];
    if (prev && isRegression(prev, record)) {
      console.warn(`careers: refused a regressing write for ${record.slug} (learning is additive)`);
      return;
    }
    this.records[record.slug] = record;
    this.flush();
  }

  /** Replace a record without the regression check (import: higher XP wins). */
  replace(record: GeniusFighterRecord): void {
    this.records[record.slug] = record;
    this.flush();
  }

  private flush(): void {
    if (!this.persistent) return;
    try {
      // Merge with what another tab may have written since we loaded.
      const disk = readStorage() ?? {};
      for (const [slug, rec] of Object.entries(disk)) {
        const mine = this.records[slug];
        if (!mine || rec.xp > mine.xp) this.records[slug] = rec;
      }
      window.localStorage.setItem(CAREERS_KEY, JSON.stringify(this.records));
    } catch {
      this.persistent = false;
    }
  }

  /** Distinct bouts across every fighter's log. */
  boutsFought(): number {
    const ids = new Set<string>();
    for (const r of this.all()) for (const e of r.log) ids.add(e.boutId);
    return ids.size;
  }
}

export const careers = new BrowserFighterStore();

export interface LearnedSide {
  before: GeniusFighterRecord;
  learning: BoutLearning;
}

/** Apply one finished bout to both fighters and persist. */
export function learnBout(
  replay: MatchReplay,
  slugs: Record<Side, string>,
  boutId: string,
  store: BrowserFighterStore = careers,
): Record<Side, LearnedSide> {
  const at = new Date().toISOString();
  const out: Partial<Record<Side, LearnedSide>> = {};
  for (const side of ['A', 'B'] as const) {
    const opp = side === 'A' ? 'B' : 'A';
    // Read fresh each time: a fighter may face itself.
    const before = store.get(slugs[side]);
    const learning = learnFromBout(before, { replay, side, opponentSlug: slugs[opp], boutId, at });
    store.put(learning.record);
    out[side] = { before, learning };
  }
  return out as Record<Side, LearnedSide>;
}

export function uniqueBoutId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

export interface CareersFile {
  format: 'vk.careers';
  version: 1;
  exportedAt: string;
  fighters: RecordMap;
}

export function exportCareers(store: BrowserFighterStore = careers): string {
  const fighters: RecordMap = {};
  for (const r of store.all()) fighters[r.slug] = r;
  const file: CareersFile = { format: 'vk.careers', version: 1, exportedAt: new Date().toISOString(), fighters };
  return JSON.stringify(file, null, 2);
}

export interface ImportSummary {
  imported: number;
  kept: number;
  skipped: number;
}

/** Merge an export into the store: per slug, the record with the higher XP wins. */
export function importCareers(json: string, store: BrowserFighterStore = careers): ImportSummary {
  const data = JSON.parse(json) as unknown;
  if (!data || typeof data !== 'object') throw new Error('Not a careers file');
  const obj = data as Record<string, unknown>;
  const src: Record<string, unknown> =
    obj.format === 'vk.careers' && obj.fighters && typeof obj.fighters === 'object'
      ? (obj.fighters as Record<string, unknown>)
      : obj;
  const known = new Set(GENIUSES.map((g) => g.slug));
  const summary: ImportSummary = { imported: 0, kept: 0, skipped: 0 };
  for (const value of Object.values(src)) {
    let rec: GeniusFighterRecord;
    try {
      rec = parseFighterRecord(value);
    } catch {
      summary.skipped++;
      continue;
    }
    if (!known.has(rec.slug)) {
      summary.skipped++;
      continue;
    }
    if (rec.xp > store.get(rec.slug).xp) {
      store.replace(rec);
      summary.imported++;
    } else summary.kept++;
  }
  return summary;
}

/** Browser download of the careers JSON. */
export function downloadCareers(): void {
  const blob = new Blob([exportCareers()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `verbal-kombat-careers-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let fileInput: HTMLInputElement | null = null;

/** Open a file picker; resolves with the summary (or rejects on a bad file). */
export function pickAndImportCareers(onDone: (result: ImportSummary | Error) => void): void {
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.style.display = 'none';
    fileInput.id = 'vk-careers-import';
    document.body.appendChild(fileInput);
  }
  const input = fileInput;
  input.value = '';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    file.text().then(
      (text) => {
        try {
          onDone(importCareers(text));
        } catch (e) {
          onDone(e instanceof Error ? e : new Error(String(e)));
        }
      },
      (e: unknown) => onDone(e instanceof Error ? e : new Error(String(e))),
    );
  };
  input.click();
}
