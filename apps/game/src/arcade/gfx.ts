/** Shared drawing helpers for the 320x224 buffer. */

import { drawText, mix, type TextOpts } from './font.js';

export const W = 320;
export const H = 224;

export const C = {
  bg: '#07060a',
  ink: '#0b0b10',
  panel: '#15121c',
  panelEdge: '#4a3f5c',
  gold: '#f2c14e',
  goldDark: '#8a5a12',
  blood: '#b0141e',
  bloodDark: '#5a0a10',
  white: '#f4efe6',
  grey: '#8d8698',
  dim: '#4d4757',
  sound: '#5fe08a',
  fallacy: '#ff5a4f',
  block: '#7fc8ff',
  cyan: '#6ef0ff',
  hpHigh: '#e8c83a',
  hpLow: '#d8342c',
} as const;

export type Gfx = CanvasRenderingContext2D;

export function rect(g: Gfx, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function frame(g: Gfx, x: number, y: number, w: number, h: number, fill: string = C.panel, edge: string = C.panelEdge): void {
  rect(g, x, y, w, h, C.ink);
  rect(g, x + 1, y + 1, w - 2, h - 2, edge);
  rect(g, x + 2, y + 2, w - 4, h - 4, fill);
  rect(g, x + 2, y + 2, w - 4, 1, mix(fill, '#ffffff', 0.12));
}

export function text(g: Gfx, s: string, x: number, y: number, opts: TextOpts = {}): number {
  return drawText(g, s, x, y, opts);
}

export function blit(g: Gfx, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, align: 'center' | 'left' = 'center'): void {
  g.drawImage(img, Math.round(align === 'center' ? x - img.width / 2 : x), Math.round(y));
}

/** Horizontal bar with bevel; value 0..1 (can be negative for EV bars). */
export function bar(g: Gfx, x: number, y: number, w: number, h: number, v: number, color: string, back = '#1d1824'): void {
  rect(g, x, y, w, h, C.ink);
  rect(g, x + 1, y + 1, w - 2, h - 2, back);
  const fw = Math.max(0, Math.min(1, v)) * (w - 2);
  if (fw > 0) {
    rect(g, x + 1, y + 1, fw, h - 2, color);
    rect(g, x + 1, y + 1, fw, 1, mix(color, '#ffffff', 0.45));
    rect(g, x + 1, y + h - 2, fw, 1, mix(color, '#000000', 0.4));
  }
}

export function dither(g: Gfx, x: number, y: number, w: number, h: number, color: string, step = 2): void {
  g.fillStyle = color;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = (yy % 2) * (step / 2); xx < w; xx += step) g.fillRect(x + xx, y + yy, 1, 1);
  }
}

export function vgrad(g: Gfx, x: number, y: number, w: number, h: number, top: string, bottom: string, bands = 12): void {
  const bh = h / bands;
  for (let i = 0; i < bands; i++) rect(g, x, y + Math.floor(i * bh), w, Math.ceil(bh) + 1, mix(top, bottom, i / (bands - 1)));
}

/** Seeded PRNG so procedural art is stable frame to frame. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function blink(frameNo: number, period = 30): boolean {
  return Math.floor(frameNo / period) % 2 === 0;
}
