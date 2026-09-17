/** The Truth HUD: health bars on top, typewriter utterance + verdict tag below. */

import { FALLACIES, WINGS, type CombatEvent, type Genius, type JudgeVerdict, type Side } from '@vk/core';
import { measure, mix, wrap } from './font.js';

const ROW = 6;
import { C, W, frame, rect, text, type Gfx } from './gfx.js';

export const STRIP_Y = 176;

export interface HpState { shown: number; trail: number; target: number }

export function newHp(): HpState {
  return { shown: 100, trail: 100, target: 100 };
}

export function stepHp(h: HpState): void {
  h.shown += (h.target - h.shown) * 0.35;
  if (Math.abs(h.target - h.shown) < 0.2) h.shown = h.target;
  if (h.trail > h.shown) h.trail = Math.max(h.shown, h.trail - 0.6);
  else h.trail = h.shown;
}

export function drawTopHud(
  g: Gfx,
  fighters: Record<Side, Genius>,
  hp: Record<Side, HpState>,
  counter: string,
  label: string,
  tick: number,
  fast: boolean,
): void {
  const bw = 132;
  for (const side of ['A', 'B'] as const) {
    const f = fighters[side];
    const h = hp[side];
    const x = side === 'A' ? 6 : W - 6 - bw;
    const low = h.shown <= 25;
    rect(g, x, 11, bw, 10, C.ink);
    rect(g, x + 1, 12, bw - 2, 8, '#3a0a10');
    const pct = (v: number) => Math.max(0, Math.min(1, v / 100)) * (bw - 2);
    const trailW = pct(h.trail);
    const fillW = pct(h.shown);
    const col = low && tick % 16 < 8 ? C.hpLow : C.hpHigh;
    if (side === 'A') {
      rect(g, x + 1 + (bw - 2) - trailW, 12, trailW, 8, '#e04030');
      rect(g, x + 1 + (bw - 2) - fillW, 12, fillW, 8, col);
      rect(g, x + 1 + (bw - 2) - fillW, 12, fillW, 2, mix(col, '#ffffff', 0.5));
    } else {
      rect(g, x + 1, 12, trailW, 8, '#e04030');
      rect(g, x + 1, 12, fillW, 8, col);
      rect(g, x + 1, 12, fillW, 2, mix(col, '#ffffff', 0.5));
    }
    rect(g, x + 1, 18, bw - 2, 2, 'rgba(0,0,0,0.25)');
    const wing = WINGS[f.wing];
    const nameAlign = side === 'A' ? 'left' : 'right';
    const nx = side === 'A' ? x : x + bw;
    text(g, f.name, nx, 3, { align: nameAlign, color: C.white });
    text(g, `${wing.name.replace(/^The /, '')}${f.living ? ' - LIVING' : ''}`, nx, 24, { align: nameAlign, color: mix(wing.palette.primary, '#ffffff', 0.35) });
    text(g, `INTEGRITY ${Math.round(h.shown)}`, side === 'A' ? x + bw : x, 24, { align: side === 'A' ? 'right' : 'left', color: low ? C.hpLow : C.grey });
  }
  // Center counter.
  frame(g, W / 2 - 14, 2, 28, 22, '#1a1020', C.goldDark);
  text(g, counter, W / 2, 9, { align: 'center', scale: 2, color: C.gold });
  text(g, label, W / 2, 26, { align: 'center', color: C.grey });
  if (fast) text(g, '>>3X', W / 2, 33, { align: 'center', color: C.cyan });
}

export function verdictTag(v: JudgeVerdict, combat: CombatEvent[]): { text: string; color: string } {
  if (v.fallacies.length > 0) {
    const names = v.fallacies.map((f) => FALLACIES[f]?.label ?? f.toUpperCase()).join(' + ');
    return { text: `FALLACY: ${names}`, color: C.fallacy };
  }
  const type = combat[0]?.type ?? 'guard';
  const kind = type === 'finisher' ? 'FINISHER' : type.replace('_', ' ').toUpperCase();
  const s = v.soundness.toFixed(2);
  if (v.soundness >= 0.6) return { text: `SOUND ${s} - ${kind}`, color: C.sound };
  return { text: `THIN ${s} - ${kind}`, color: C.grey };
}

export class TruthStrip {
  private full = '';
  private shownChars = 0;
  private speaker = '';
  private speakerColor: string = C.white;
  private tag: { text: string; color: string } | null = null;
  private tagT = 0;
  private lines: string[] = [];

  say(speaker: string, color: string, utterance: string): void {
    this.speaker = speaker;
    this.speakerColor = color;
    this.full = utterance;
    this.shownChars = 0;
    this.tag = null;
    this.lines = wrap(utterance, W - 16);
  }

  setTag(tag: { text: string; color: string }): void {
    this.tag = tag;
    this.tagT = 0;
  }

  get done(): boolean {
    return this.shownChars >= this.totalChars;
  }

  private get totalChars(): number {
    return this.lines.reduce((s, l) => s + l.length + 1, 0);
  }

  skip(): void {
    this.shownChars = this.totalChars;
  }

  step(rate = 1.5): void {
    this.shownChars = Math.min(this.totalChars, this.shownChars + rate);
    this.tagT++;
  }

  clear(): void {
    this.full = '';
    this.lines = [];
    this.tag = null;
    this.speaker = '';
  }

  render(g: Gfx, tick: number, hint: string): void {
    frame(g, 0, STRIP_Y, W, 224 - STRIP_Y, '#0e0b14', '#3a3048');
    const y0 = STRIP_Y + 4;
    if (this.speaker) text(g, this.speaker, 6, y0, { color: this.speakerColor });
    else text(g, hint, 6, y0, { color: C.dim });
    if (this.tag) {
      const pop = this.tagT < 6 ? 1 : 0;
      const tw = text(g, this.tag.text, W - 6, y0 - pop, { align: 'right', color: this.tag.color });
      if (this.tagT < 20 && tick % 4 < 2) rect(g, W - 8 - tw, y0 + 6, tw + 4, 1, this.tag.color);
    }
    // Visible text: last 5 wrapped lines of what has been typed.
    let left = Math.floor(this.shownChars);
    const typed: string[] = [];
    for (const l of this.lines) {
      if (left <= 0) break;
      typed.push(l.slice(0, left));
      left -= l.length + 1;
    }
    const vis = typed.slice(-5);
    vis.forEach((l, i) => text(g, l, 8, y0 + 9 + i * ROW, { color: '#e8e0d0' }));
    if (!this.done && vis.length > 0 && tick % 10 < 5) {
      const last = vis[vis.length - 1]!;
      rect(g, 8 + measure(last) + 2, y0 + 9 + (vis.length - 1) * ROW, 3, 5, C.gold);
    }
  }
}
