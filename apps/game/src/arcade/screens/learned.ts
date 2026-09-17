/** POST-BOUT: "WHAT THEY LEARNED" — XP, level ups, and the newest lessons. */

import { WINGS, XP_PER_LEVEL, levelForXp, type Genius, type Lesson, type Side } from '@vk/core';
import type { LearnedSide } from '../careers.js';
import type { Game, Screen } from '../engine.js';
import { bigText, mix, wrap } from '../font.js';
import { C, H, W, bar, blink, blit, frame, rect, text, vgrad, type Gfx } from '../gfx.js';
import { hint, portrait, tile } from './common.js';

const PANEL_W = 154;
const TEXT_W = PANEL_W - 12;
const LINE = 6;
const MAX_LINES = 14;
const XP_FRAMES = 90;

interface PanelState {
  side: Side;
  genius: Genius;
  data: LearnedSide;
  gained: number;
  label: string;
  labelColor: string;
  lines: { text: string; color: string }[];
  totalChars: number;
  levelShown: number;
  flashT: number;
}

/** Level-relative XP progress, 0..1. */
export function levelProgress(xp: number): number {
  const lvl = levelForXp(xp);
  return Math.max(0, Math.min(1, (xp - (lvl - 1) * XP_PER_LEVEL) / XP_PER_LEVEL));
}

function kindTag(l: Lesson): string {
  switch (l.kind) {
    case 'avoid_fallacy':
      return 'AVOID';
    case 'counter':
      return 'COUNTER';
    case 'technique':
      return 'TECHNIQUE';
    case 'blind_spot':
      return 'BLIND SPOT';
  }
}

function buildLines(d: LearnedSide): { text: string; color: string }[] {
  const { newLessons, reinforced } = d.learning;
  const picks: { lesson: Lesson; fresh: boolean }[] = [
    ...[...newLessons].reverse().map((lesson) => ({ lesson, fresh: true })),
    ...reinforced.map((lesson) => ({ lesson, fresh: false })),
  ].slice(0, 3);
  const out: { text: string; color: string }[] = [];
  if (picks.length === 0) out.push({ text: 'NO NEW LESSON THIS TIME - THE RECORD STILL GREW.', color: C.grey });
  const perLesson = Math.max(3, Math.floor(MAX_LINES / Math.max(1, picks.length)) - 1);
  for (const { lesson, fresh } of picks) {
    if (out.length >= MAX_LINES) break;
    const head = fresh ? `NEW ${kindTag(lesson)}` : `REINFORCED ${kindTag(lesson)} X${lesson.seen}`;
    out.push({ text: head, color: fresh ? C.gold : C.cyan });
    const body = wrap(lesson.text, TEXT_W);
    const cut = body.slice(0, perLesson);
    if (body.length > cut.length && cut.length > 0) cut[cut.length - 1] = `${cut[cut.length - 1]!.replace(/\.*$/, '')}...`;
    for (const l of cut) {
      if (out.length >= MAX_LINES) break;
      const last = out.length === MAX_LINES - 1 && l !== cut[cut.length - 1];
      out.push({ text: last ? `${l.replace(/\.*$/, '')}...` : l, color: C.white });
    }
  }
  return out;
}

export class LearnedScreen implements Screen {
  readonly name = 'learned';
  private t = 0;
  private chars = 0;
  private readonly panels: PanelState[];

  constructor(
    fighters: Record<Side, Genius>,
    learned: Record<Side, LearnedSide>,
    private readonly title: string,
    private readonly onDone: (game: Game) => void,
  ) {
    this.panels = (['A', 'B'] as const).map((side) => {
      const data = learned[side];
      const result = data.learning.entry.result;
      const lines = buildLines(data);
      return {
        side,
        genius: fighters[side],
        data,
        gained: data.learning.entry.xpGained,
        label: result === 'win' ? 'WON - KEPT ITS BEST MOVE' : result === 'loss' ? 'STUDIED THE LOSS' : 'DRAW - REVIEWED THE BOUT',
        labelColor: result === 'win' ? C.gold : result === 'loss' ? C.fallacy : C.grey,
        lines,
        totalChars: lines.reduce((s, l) => s + l.text.length + 1, 0),
        levelShown: data.before.level,
        flashT: 0,
      };
    });
  }

  /** Test/debug probe. */
  get levelUps(): number {
    return this.panels.filter((p) => p.data.learning.record.level > p.data.before.level).length;
  }

  private get xpK(): number {
    return Math.max(0, Math.min(1, (this.t - 20) / XP_FRAMES));
  }

  private get done(): boolean {
    return this.xpK >= 1 && this.panels.every((p) => this.chars >= p.totalChars);
  }

  enter(game: Game): void {
    game.audio.play('confirm');
  }

  update(game: Game): void {
    this.t++;
    const k = this.xpK;
    if (k > 0 && k < 1 && this.t % 4 === 0) game.audio.play('xp');
    for (const p of this.panels) {
      const shown = this.shownXp(p);
      const lvl = levelForXp(shown);
      if (lvl > p.levelShown) {
        p.levelShown = lvl;
        p.flashT = 1;
        game.audio.play('levelup');
        game.audio.announce('Level up');
        game.shake(2, 8);
      }
      if (p.flashT > 0) p.flashT++;
    }
    if (this.t > 30) this.chars += 1.6;
    const inp = game.input;
    if (inp.ok() && this.t > 10) {
      if (!this.done) {
        this.t = Math.max(this.t, 20 + XP_FRAMES);
        this.chars = 1e6;
      } else {
        game.audio.play('confirm');
        this.onDone(game);
      }
    } else if (inp.pressed('back') && this.t > 30) {
      game.audio.play('back');
      this.onDone(game);
    }
  }

  private shownXp(p: PanelState): number {
    const k = this.xpK;
    const ease = 1 - (1 - k) ** 2;
    return Math.round(p.data.before.xp + p.gained * ease);
  }

  render(g: Gfx): void {
    vgrad(g, 0, 0, W, H, '#0c0c1c', '#040208');
    blit(g, bigText('WHAT THEY LEARNED', 2, '#e0fbff', '#2a7ab0'), W / 2, 3);
    text(g, this.title, W / 2, 18, { align: 'center', color: C.grey });
    this.panels.forEach((p, i) => this.panel(g, p, i === 0 ? 4 : W - 4 - PANEL_W));
    if (this.done && blink(this.t, 20)) hint(g, 'ENTER - CONTINUE');
    else if (!this.done) hint(g, 'ENTER - SKIP');
  }

  private panel(g: Gfx, p: PanelState, x: number): void {
    const gn = p.genius;
    const wing = WINGS[gn.wing];
    const y = 26;
    const flashing = p.flashT > 0 && p.flashT < 70;
    frame(g, x, y, PANEL_W, 186, '#110e1a', flashing && blink(p.flashT, 4) ? C.gold : p.side === 'A' ? C.goldDark : '#2a6a8a');
    tile(g, gn.wing, x + 5, y + 5, 28, 30);
    portrait(g, gn.wing, x + 6, y + 6, 1, 1);
    const nameLines = wrap(gn.name, PANEL_W - 44).slice(0, 2);
    nameLines.forEach((l, k) => text(g, l, x + 38, y + 5 + k * 7, { color: mix(wing.palette.primary, '#ffffff', 0.45) }));
    text(g, p.label, x + 38, y + 5 + nameLines.length * 7 + 1, { color: p.labelColor });
    // XP.
    const shown = this.shownXp(p);
    const lvl = levelForXp(shown);
    const gainedNow = shown - p.data.before.xp;
    text(g, `LV ${lvl}`, x + 6, y + 40, { color: C.white, scale: 2 });
    text(g, `+${gainedNow} XP`, x + PANEL_W - 6, y + 40, { align: 'right', color: C.sound });
    text(g, `${shown} XP`, x + PANEL_W - 6, y + 48, { align: 'right', color: C.dim });
    const col = flashing && blink(p.flashT, 4) ? '#ffffff' : C.cyan;
    bar(g, x + 6, y + 56, PANEL_W - 12, 7, levelProgress(shown), col);
    text(g, `${lvl * XP_PER_LEVEL - shown} TO LV ${lvl + 1}`, x + 6, y + 65, { color: C.grey });
    const lossStudy = p.data.learning.entry.result === 'loss';
    if (lossStudy) text(g, 'LOSS STUDY BONUS', x + PANEL_W - 6, y + 65, { align: 'right', color: C.fallacy });
    if (p.flashT > 0) {
      const bounce = Math.round(Math.max(0, 6 - p.flashT) * 1.5);
      if (!flashing || p.flashT < 20 || blink(p.flashT, 6)) {
        blit(g, bigText('LEVEL UP!', 2, '#fff3c0', '#f2a020'), x + PANEL_W / 2, y + 38 - bounce);
      }
    }
    rect(g, x + 6, y + 74, PANEL_W - 12, 1, C.panelEdge);
    // Lessons, typewriter.
    let left = Math.floor(this.chars);
    p.lines.forEach((l, k) => {
      if (left <= 0) return;
      const s = l.text.slice(0, left);
      left -= l.text.length + 1;
      text(g, s, x + 6, y + 79 + k * LINE, { color: l.color, shadow: null });
    });
    const wards = Object.keys(p.data.learning.record.strengths.fallacyWards).length;
    const lessons = p.data.learning.record.lessons.length;
    const bouts = p.data.learning.record.record.matches;
    text(g, `${lessons} LESSON${lessons === 1 ? '' : 'S'} - ${wards} WARD${wards === 1 ? '' : 'S'} - ${bouts} BOUT${bouts === 1 ? '' : 'S'}`, x + 6, y + 176, { color: C.dim, shadow: null });
  }
}
