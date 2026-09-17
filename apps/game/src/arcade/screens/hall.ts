/** HALL OF MINDS: every fighter's career — level, strengths, lessons, and bout log. */

import {
  FALLACIES,
  MAX_TRAIT_GAIN,
  MAX_WARD,
  WING_ORDER,
  WINGS,
  XP_PER_LEVEL,
  geniusesInWing,
  getGenius,
  type FallacyId,
  type Genius,
  type GeniusFighterRecord,
  type Lesson,
} from '@vk/core';
import { careers, downloadCareers, pickAndImportCareers } from '../careers.js';
import type { Game, Screen } from '../engine.js';
import { bigText, mix, wrap } from '../font.js';
import { C, H, W, bar, blink, blit, frame, rect, text, vgrad, type Gfx } from '../gfx.js';
import { toMode } from '../flow.js';
import { portrait, tile } from './common.js';
import { fit } from './menus.js';

const TILE_W = 25;
const TILE_X = (W - TILE_W * 12) / 2;
const LIST_X = 4;
const LIST_W = 120;
const LIST_Y = 58;
const LIST_ROWS = 21;
const PX = 128;
const PY = 48;
const PW = W - PX - 4;
const PH = 164;
const LOG_Y = PY + 96;
const LOG_ROWS = 10;
const ROW = 6;

type Tab = 'lessons' | 'bouts';
interface Line {
  text: string;
  color: string;
  right?: string;
  rightColor?: string;
}

const KIND: Record<Lesson['kind'], [string, string]> = {
  avoid_fallacy: ['AVOID', C.fallacy],
  counter: ['COUNTER', C.cyan],
  technique: ['TECHNIQUE', C.sound],
  blind_spot: ['BLIND SPOT', C.gold],
};

const TRAIT_SHORT: Record<string, string> = {
  interrogation: 'QUESTION',
  empiricism: 'EVIDENCE',
  formalism: 'LOGIC',
  rhetoric: 'RHETORIC',
  patience: 'PATIENCE',
  aggression: 'PRESSURE',
};

function nameOf(slug: string): string {
  try {
    return getGenius(slug).name;
  } catch {
    return slug;
  }
}

export function lessonLines(rec: GeniusFighterRecord, width: number): Line[] {
  const out: Line[] = [];
  if (rec.lessons.length === 0) return [{ text: 'NO LESSONS YET. THE LOSER ALWAYS LEARNS -', color: C.dim }, { text: 'SEND THIS MIND INTO A BOUT.', color: C.dim }];
  const newest = [...rec.lessons].reverse();
  newest.forEach((l, i) => {
    const [tag, col] = KIND[l.kind];
    out.push({
      text: `${tag}${l.seen > 1 ? ` X${l.seen}` : ''}`,
      color: col,
      right: `${l.learnedAt.slice(0, 10)}${l.opponent ? ` VS ${nameOf(l.opponent)}` : ''}`,
      rightColor: C.dim,
    });
    for (const w of wrap(l.text, width)) out.push({ text: w, color: C.white });
    if (i < newest.length - 1) out.push({ text: '', color: C.dim });
  });
  return out;
}

export function boutLines(rec: GeniusFighterRecord, width: number): Line[] {
  if (rec.log.length === 0) return [{ text: 'NO BOUTS YET.', color: C.dim }];
  const out: Line[] = [];
  const newest = [...rec.log].reverse();
  newest.forEach((e, i) => {
    const col = e.result === 'win' ? C.gold : e.result === 'loss' ? C.fallacy : C.grey;
    out.push({ text: fit(`${e.result.toUpperCase()} VS ${nameOf(e.opponent)}`, width - 50), color: col, right: `+${e.xpGained} XP`, rightColor: C.sound });
    const learned = e.lessonsGained.length ? ` · +${e.lessonsGained.length} LESSON${e.lessonsGained.length === 1 ? '' : 'S'}` : '';
    out.push({ text: `INTEGRITY ${Math.round(e.finalIntegrity)}-${Math.round(e.opponentIntegrity)} · LV ${e.levelAfter}${learned}`, color: C.grey });
    const falls = e.fallacies.length ? ` · ${e.fallacies.length} FALLAC${e.fallacies.length === 1 ? 'Y' : 'IES'}` : ' · CLEAN';
    out.push({ text: fit(`${e.at.slice(0, 10)}${falls} · ${e.topic}`, width), color: C.dim });
    if (i < newest.length - 1) out.push({ text: '', color: C.dim });
  });
  return out;
}

export class HallScreen implements Screen {
  readonly name = 'hall';
  private wing = 0;
  private member: number[] = WING_ORDER.map(() => 0);
  private tab: Tab = 'lessons';
  private focusLog = false;
  private scroll = 0;
  private t = 0;
  private busy = false;

  enter(): void {
    // Open on the most experienced mind.
    const top = [...careers.all()].sort((a, b) => b.xp - a.xp)[0];
    const slug = top?.slug ?? 'socrates';
    const g = getGenius(slug);
    this.wing = Math.max(0, WING_ORDER.indexOf(g.wing));
    this.member[this.wing] = Math.max(0, geniusesInWing(g.wing).findIndex((x) => x.slug === slug));
  }

  /** Debug/test probe. */
  get state(): { slug: string; tab: Tab; focusLog: boolean; scroll: number } {
    return { slug: this.current().slug, tab: this.tab, focusLog: this.focusLog, scroll: this.scroll };
  }

  private current(): Genius {
    const list = geniusesInWing(WING_ORDER[this.wing]!);
    return list[this.member[this.wing] ?? 0] ?? list[0]!;
  }

  private lines(): Line[] {
    const rec = careers.get(this.current().slug);
    return this.tab === 'lessons' ? lessonLines(rec, PW - 16) : boutLines(rec, PW - 16);
  }

  private maxScroll(): number {
    return Math.max(0, this.lines().length - LOG_ROWS);
  }

  update(game: Game): void {
    this.t++;
    const inp = game.input;
    const xKey = inp.key('KeyX');
    if (xKey) {
      downloadCareers();
      game.audio.play('confirm');
      game.notify('CAREERS EXPORTED');
      return;
    }
    if (inp.key('KeyI') && !this.busy) {
      this.busy = true;
      game.audio.play('confirm');
      pickAndImportCareers((res) => {
        this.busy = false;
        if (res instanceof Error) game.notify('IMPORT FAILED: NOT A CAREERS FILE');
        else game.notify(`IMPORTED ${res.imported} - KEPT ${res.kept}${res.skipped ? ` - SKIPPED ${res.skipped}` : ''}`);
        this.scroll = Math.min(this.scroll, this.maxScroll());
      });
      // The picker's cancel is silent; allow another try shortly.
      setTimeout(() => (this.busy = false), 1500);
      return;
    }
    if (inp.key('Tab') || inp.key('KeyQ') || inp.key('KeyE')) {
      this.tab = this.tab === 'lessons' ? 'bouts' : 'lessons';
      this.scroll = 0;
      game.audio.play('move');
    }
    if (inp.key('PageDown')) this.scroll = Math.min(this.maxScroll(), this.scroll + LOG_ROWS - 1);
    if (inp.key('PageUp')) this.scroll = Math.max(0, this.scroll - (LOG_ROWS - 1));

    if (this.focusLog) {
      if (inp.pressed('up')) this.scroll = Math.max(0, this.scroll - 1);
      if (inp.pressed('down')) this.scroll = Math.min(this.maxScroll(), this.scroll + 1);
      if (inp.pressed('back') || inp.ok()) {
        this.focusLog = false;
        game.audio.play('back');
      }
      return;
    }

    const w = this.wing;
    const list = geniusesInWing(WING_ORDER[w]!);
    const m = this.member;
    let moved = false;
    if (inp.pressed('left')) { this.wing = (w + 11) % 12; moved = true; }
    if (inp.pressed('right')) { this.wing = (w + 1) % 12; moved = true; }
    if (inp.pressed('up')) { m[w] = ((m[w] ?? 0) + list.length - 1) % list.length; moved = true; }
    if (inp.pressed('down')) { m[w] = ((m[w] ?? 0) + 1) % list.length; moved = true; }
    if (moved) {
      this.scroll = 0;
      game.audio.play('move');
    }
    if (inp.ok()) {
      this.focusLog = true;
      game.audio.play('confirm');
    } else if (inp.pressed('back')) {
      game.audio.play('back');
      toMode(game);
    }
  }

  render(g: Gfx): void {
    vgrad(g, 0, 0, W, H, '#0e0a18', '#040208');
    blit(g, bigText('HALL OF MINDS', 2, '#fff3c0', '#b8740e'), W / 2, 2);
    const gn = this.current();
    const rec = careers.get(gn.slug);

    WING_ORDER.forEach((wingId, i) => {
      const x = TILE_X + i * TILE_W;
      const y = 16;
      tile(g, wingId, x, y, TILE_W - 1, 28);
      portrait(g, wingId, x, y + 1, 1, 1);
      if (i === this.wing && (this.focusLog || blink(this.t, 8))) {
        g.strokeStyle = C.gold;
        g.lineWidth = 1;
        g.strokeRect(x - 0.5, y - 0.5, TILE_W, 29);
      }
    });

    // Member list.
    const wing = WINGS[WING_ORDER[this.wing]!];
    text(g, fit(wing.name, LIST_W), LIST_X + 2, 49, { color: mix(wing.palette.primary, '#ffffff', 0.4) });
    const list = geniusesInWing(WING_ORDER[this.wing]!);
    const sel = this.member[this.wing] ?? 0;
    frame(g, LIST_X, LIST_Y - 2, LIST_W, PH - (LIST_Y - PY) + 2, '#120e18', this.focusLog ? C.panelEdge : C.goldDark);
    const start = Math.max(0, Math.min(list.length - LIST_ROWS, sel - Math.floor(LIST_ROWS / 2)));
    list.slice(start, start + LIST_ROWS).forEach((m, k) => {
      const idx = start + k;
      const y = LIST_Y + 2 + k * 7;
      const on = idx === sel;
      if (on) rect(g, LIST_X + 3, y - 1, LIST_W - 6, 7, this.focusLog ? '#2a2034' : '#5a3a10');
      const r = careers.get(m.slug);
      text(g, fit(m.name, LIST_W - 36), LIST_X + 6, y, { color: on ? '#ffffff' : C.grey, shadow: null });
      text(g, `LV ${r.level}`, LIST_X + LIST_W - 5, y, { align: 'right', color: r.level > 1 ? C.gold : r.record.matches > 0 ? C.white : C.dim, shadow: null });
    });
    text(g, `${sel + 1}/${list.length}`, LIST_X + LIST_W - 4, 49, { align: 'right', color: C.dim, shadow: null });

    this.panel(g, gn, rec);
    const hintText = this.focusLog
      ? 'UP/DOWN SCROLL - TAB/Q/E SWITCH - ESC LIST - X EXPORT - I IMPORT'
      : 'ARROWS BROWSE - ENTER LOG - TAB/Q/E SWITCH - X EXPORT - I IMPORT';
    text(g, hintText, W / 2, 216, { align: 'center', color: C.dim });
  }

  private panel(g: Gfx, gn: Genius, rec: GeniusFighterRecord): void {
    const x = PX;
    const y = PY;
    const wing = WINGS[gn.wing];
    frame(g, x, y, PW, PH, '#100c18', this.focusLog ? C.gold : C.panelEdge);
    tile(g, gn.wing, x + 5, y + 5, 28, 30);
    portrait(g, gn.wing, x + 6, y + 6, 1, 1);
    text(g, fit(gn.name, PW - 44), x + 38, y + 5, { color: C.white });
    text(g, fit(`${wing.name}${gn.living ? ' - LIVING' : ''}`, PW - 44), x + 38, y + 12, { color: mix(wing.palette.primary, '#ffffff', 0.45) });
    text(g, `LV ${rec.level}`, x + 38, y + 21, { color: C.gold, scale: 2 });
    const into = rec.xp - (rec.level - 1) * XP_PER_LEVEL;
    bar(g, x + 84, y + 22, PW - 90, 6, into / XP_PER_LEVEL, C.cyan);
    text(g, `${rec.xp} XP · ${rec.level * XP_PER_LEVEL - rec.xp} TO LV ${rec.level + 1}`, x + 84, y + 30, { color: C.grey, shadow: null });
    const r = rec.record;
    text(g, `W-L-D ${r.wins}-${r.losses}-${r.draws} · ${r.matches} BOUTS · ${r.fallaciesCommitted} FALLACIES`, x + 6, y + 40, { color: C.white });

    // Earned strengths.
    const colW = (PW - 16) / 2;
    text(g, 'FALLACY WARDS', x + 6, y + 50, { color: C.fallacy, shadow: null });
    text(g, 'TRAIT GAINS', x + 10 + colW, y + 50, { color: C.sound, shadow: null });
    const wards = (Object.entries(rec.strengths.fallacyWards) as [FallacyId, number][]).sort((a, b) => b[1] - a[1]);
    const gains = (Object.entries(rec.strengths.traitGains) as [string, number][]).sort((a, b) => b[1] - a[1]);
    const rows = wards.length > 4 ? 3 : 4;
    if (wards.length === 0) text(g, 'NONE YET', x + 6, y + 58, { color: C.dim, shadow: null });
    wards.slice(0, rows).forEach(([f, v], i) => {
      const yy = y + 58 + i * 7;
      text(g, fit(FALLACIES[f]?.label ?? f, colW - 32), x + 6, yy, { color: C.grey, shadow: null });
      bar(g, x + 6 + colW - 30, yy, 26, 5, v / MAX_WARD, C.fallacy);
    });
    if (wards.length > rows) text(g, `+${wards.length - rows} MORE`, x + 6, y + 58 + rows * 7, { color: C.dim, shadow: null });
    if (gains.length === 0) text(g, 'NONE YET', x + 10 + colW, y + 58, { color: C.dim, shadow: null });
    gains.slice(0, rows).forEach(([k, v], i) => {
      const yy = y + 58 + i * 7;
      text(g, fit(`${TRAIT_SHORT[k] ?? k} +${(v * 100).toFixed(1)}%`, colW - 32), x + 10 + colW, yy, { color: C.grey, shadow: null });
      bar(g, x + 10 + colW + colW - 30, yy, 26, 5, v / MAX_TRAIT_GAIN, C.sound);
    });

    // Tabs.
    const tabs: [Tab, string][] = [
      ['lessons', `LESSONS (${rec.lessons.length})`],
      ['bouts', `BOUTS (${rec.log.length})`],
    ];
    tabs.forEach(([id, label], i) => {
      const tx = x + 6 + i * 72;
      const on = this.tab === id;
      rect(g, tx, y + 86, 68, 9, on ? '#3a2a10' : '#1a1624');
      rect(g, tx, y + 94, 68, 1, on ? C.gold : C.panelEdge);
      text(g, label, tx + 34, y + 88, { align: 'center', color: on ? C.gold : C.grey, shadow: null });
    });
    rect(g, x + 6, LOG_Y - 1, PW - 12, 1, C.panelEdge);

    // Log.
    const lines = this.lines();
    const max = Math.max(0, lines.length - LOG_ROWS);
    if (this.scroll > max) this.scroll = max;
    lines.slice(this.scroll, this.scroll + LOG_ROWS).forEach((l, k) => {
      const yy = LOG_Y + 2 + k * ROW;
      text(g, l.text, x + 6, yy, { color: l.color, shadow: null });
      if (l.right) text(g, fit(l.right, 90), x + PW - 12, yy, { align: 'right', color: l.rightColor ?? C.dim, shadow: null });
    });
    if (lines.length > LOG_ROWS) {
      const trackH = LOG_ROWS * ROW;
      const thumb = Math.max(6, (trackH * LOG_ROWS) / lines.length);
      const ty = LOG_Y + 1 + ((trackH - thumb) * this.scroll) / Math.max(1, max);
      rect(g, x + PW - 7, LOG_Y + 1, 2, trackH, '#1d1824');
      rect(g, x + PW - 7, ty, 2, thumb, this.focusLog ? C.gold : C.grey);
    }
  }
}
