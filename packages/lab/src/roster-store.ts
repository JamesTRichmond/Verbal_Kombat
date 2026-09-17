/**
 * FileFighterStore — every genius fighter's career on disk.
 *
 *   <root>/<slug>.json   the record (pretty JSON, source of truth)
 *   <root>/<slug>.md     renderFighterLog output, regenerated on every put
 *   <root>/README.md     standings for all 186 (writeIndex)
 *
 * Growth is additive, and this layer enforces it: put() refuses any record
 * whose XP, bout log, lesson count, or match count is lower than what is
 * already on disk. Writes go to a temp file first and are renamed into
 * place, so a crash mid-write cannot truncate a career.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  GENIUSES,
  WINGS,
  newFighterRecord,
  parseFighterRecord,
  renderFighterLog,
  type GeniusFighterRecord,
} from '@vk/core';
import type { FighterStore } from '@vk/replay';

export const DEFAULT_ROSTER_DIR = 'data/fighters';

export class GrowthRegressionError extends Error {
  constructor(slug: string, what: string, disk: number, next: number) {
    super(`Refusing to write ${slug}: ${what} would drop from ${disk} to ${next} (growth is additive).`);
    this.name = 'GrowthRegressionError';
  }
}

export class FileFighterStore implements FighterStore {
  readonly root: string;

  constructor(root: string = DEFAULT_ROSTER_DIR) {
    this.root = resolve(process.cwd(), root);
  }

  jsonPath(slug: string): string {
    return join(this.root, `${safeSlug(slug)}.json`);
  }

  logPath(slug: string): string {
    return join(this.root, `${safeSlug(slug)}.md`);
  }

  has(slug: string): boolean {
    return existsSync(this.jsonPath(slug));
  }

  get(slug: string): GeniusFighterRecord {
    const path = this.jsonPath(slug);
    if (!existsSync(path)) return newFighterRecord(slug);
    return parseFighterRecord(JSON.parse(readFileSync(path, 'utf8')));
  }

  put(record: GeniusFighterRecord): void {
    const next = parseFighterRecord(record);
    if (this.has(next.slug)) {
      const disk = this.get(next.slug);
      const checks: [string, number, number][] = [
        ['xp', disk.xp, next.xp],
        ['bout log length', disk.log.length, next.log.length],
        ['lesson count', disk.lessons.length, next.lessons.length],
        ['matches', disk.record.matches, next.record.matches],
      ];
      for (const [what, d, n] of checks) {
        if (n < d) throw new GrowthRegressionError(next.slug, what, d, n);
      }
      const nextLessons = new Map(next.lessons.map((l) => [l.id, l]));
      for (const l of disk.lessons) {
        const kept = nextLessons.get(l.id);
        if (!kept) throw new Error(`Refusing to write ${next.slug}: lesson ${l.id} would be removed (growth is additive).`);
        if (kept.seen < l.seen) throw new GrowthRegressionError(next.slug, `lesson ${l.id} seen`, l.seen, kept.seen);
      }
    }
    mkdirSync(this.root, { recursive: true });
    atomicWrite(this.jsonPath(next.slug), `${JSON.stringify(next, null, 2)}\n`);
    atomicWrite(this.logPath(next.slug), renderFighterLog(next));
  }

  /** Create a record for every genius that lacks one. Never overwrites. Returns how many were created. */
  ensureAll(): number {
    let created = 0;
    for (const g of GENIUSES) {
      if (this.has(g.slug)) {
        // Keep the log view present even if only the JSON survived.
        if (!existsSync(this.logPath(g.slug))) atomicWrite(this.logPath(g.slug), renderFighterLog(this.get(g.slug)));
        continue;
      }
      this.put(newFighterRecord(g.slug));
      created++;
    }
    return created;
  }

  /** Every genius's record, in roster order (missing ones come back fresh). */
  all(): GeniusFighterRecord[] {
    return GENIUSES.map((g) => this.get(g.slug));
  }

  standings(): GeniusFighterRecord[] {
    return rankFighters(this.all());
  }

  /** Write <root>/README.md with the standings table. Returns its path. */
  writeIndex(): string {
    mkdirSync(this.root, { recursive: true });
    const path = join(this.root, 'README.md');
    atomicWrite(path, renderStandingsMarkdown(this.standings()));
    return path;
  }
}

/** Rank by level, then XP, then wins; ties keep name order. */
export function rankFighters(records: GeniusFighterRecord[]): GeniusFighterRecord[] {
  return [...records].sort(
    (a, b) =>
      b.level - a.level ||
      b.xp - a.xp ||
      b.record.wins - a.record.wins ||
      a.name.localeCompare(b.name),
  );
}

function wingName(rec: GeniusFighterRecord): string {
  return WINGS[rec.wing]?.name ?? rec.wing;
}

function wld(rec: GeniusFighterRecord): string {
  return `${rec.record.wins}-${rec.record.losses}-${rec.record.draws}`;
}

export function renderStandingsMarkdown(ranked: GeniusFighterRecord[]): string {
  const bouts = ranked.reduce((n, r) => n + r.record.matches, 0) / 2;
  const lines = [
    '# Genius fighter standings',
    '',
    `${ranked.length} fighters · ${bouts} bouts fought · ranked by level, then XP, then wins.`,
    'Each fighter has a career file (`<slug>.json`) and a readable log (`<slug>.md`). See docs/GROWTH.md.',
    '',
    '| Rank | Fighter | Wing | Level | XP | W-L-D | Lessons |',
    '|---:|---|---|---:|---:|---|---:|',
    ...ranked.map(
      (r, i) =>
        `| ${i + 1} | [${r.name}](${r.slug}.md) | ${wingName(r)} | ${r.level} | ${r.xp} | ${wld(r)} | ${r.lessons.length} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

/** Fixed-width standings for terminals. */
export function renderStandingsTable(ranked: GeniusFighterRecord[], top?: number): string {
  const shown = top !== undefined ? ranked.slice(0, top) : ranked;
  const header = ['#', 'fighter', 'wing', 'lv', 'xp', 'W-L-D', 'lessons'];
  const rows = shown.map((r, i) => [
    String(i + 1),
    r.name,
    wingName(r),
    String(r.level),
    String(r.xp),
    wld(r),
    String(r.lessons.length),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ').trimEnd();
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

let tmpCounter = 0;

function atomicWrite(path: string, data: string): void {
  const tmp = `${path}.tmp-${++tmpCounter}`;
  writeFileSync(tmp, data, 'utf8');
  renameSync(tmp, path);
}

function safeSlug(slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Invalid fighter slug: ${slug}`);
  return slug;
}
