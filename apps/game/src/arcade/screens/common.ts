/** Shared bits for menu screens. */

import { WINGS, type WingId } from '@vk/core';
import { mix } from '../font.js';
import { C, rect, text, type Gfx } from '../gfx.js';
import { sprite } from '../sprites.js';

/** Head-and-shoulders crop of a fighter's idle frame. */
export function portrait(g: Gfx, wing: WingId, x: number, y: number, scale = 1, facing: 1 | -1 = 1, frame: 'idle0' | 'win0' = 'idle0'): void {
  const s = sprite(wing, frame);
  const sx = 30;
  const sy = 4;
  const w = 26;
  const h = 26;
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(facing, 1);
  g.drawImage(s, sx, sy, w, h, facing === 1 ? 0 : -w * scale, 0, w * scale, h * scale);
  g.restore();
}

export function tile(g: Gfx, wing: WingId, x: number, y: number, w: number, h: number): void {
  const p = WINGS[wing].palette;
  rect(g, x, y, w, h, C.ink);
  rect(g, x + 1, y + 1, w - 2, h - 2, mix(p.secondary, p.primary, 0.35));
  rect(g, x + 1, y + 1, w - 2, 1, mix(p.primary, '#ffffff', 0.3));
}

/** A small procedural crown. */
export function crown(g: Gfx, cx: number, y: number, s = 1): void {
  const px = (x: number, yy: number, w: number, h: number, c: string) => rect(g, cx + x * s, y + yy * s, w * s, h * s, c);
  px(-8, 4, 17, 5, C.gold);
  px(-8, 0, 3, 4, C.gold);
  px(-1, -2, 3, 6, C.gold);
  px(6, 0, 3, 4, C.gold);
  px(-8, 8, 17, 1, C.goldDark);
  px(-7, 5, 2, 2, C.fallacy);
  px(0, 5, 2, 2, C.cyan);
  px(6, 5, 2, 2, C.sound);
  px(-8, 4, 17, 1, '#fff2b0');
}

export function hint(g: Gfx, s: string): void {
  text(g, s, 160, 216, { align: 'center', color: C.dim });
}

export function fmt(n: number, digits = 2): string {
  return (n >= 0 ? '+' : '') + n.toFixed(digits);
}
