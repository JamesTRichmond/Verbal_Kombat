/**
 * Procedural pixel-art fighters.
 *
 * One masked-humanoid body template, posed by a joint skeleton, rasterized
 * into an indexed buffer, auto-shaded and outlined, then palette-swapped per
 * wing (WINGS[wing].palette) with a wing-specific headgear and chest sigil.
 * No image files, no likenesses: every fighter is a mask, a wing, a method.
 */

import { WINGS, type WingId } from '@vk/core';
import { hex, mix } from './font.js';

export type FrameName =
  | 'idle0' | 'idle1'
  | 'walk0' | 'walk1' | 'walk2' | 'walk3'
  | 'jab0' | 'jab1'
  | 'heavy0' | 'heavy1'
  | 'upper0' | 'upper1'
  | 'hit0' | 'hit1'
  | 'block'
  | 'stumble0' | 'stumble1'
  | 'fall0' | 'fall1'
  | 'kneel'
  | 'win0' | 'win1';

export type Variant = 'normal' | 'white' | 'glass';

export const SPR_W = 84;
export const SPR_H = 90;
/** Where the feet sit inside the sprite canvas. */
export const ORIGIN_X = 42;
export const ORIGIN_Y = 86;

type J = readonly [number, number];
interface Pose {
  hip: J; neck: J; head: J;
  fe: J; fh: J; be: J; bh: J;
  fk: J; ff: J; bk: J; bf: J;
}

const IDLE: Pose = {
  hip: [0, -30], neck: [2, -54], head: [3, -63],
  fe: [9, -46], fh: [14, -54], be: [-3, -44], bh: [5, -48],
  fk: [7, -15], ff: [10, 0], bk: [-6, -15], bf: [-10, 0],
};

function pose(over: Partial<Pose>): Pose {
  return { ...IDLE, ...over };
}

const POSES: Record<FrameName, Pose> = {
  idle0: IDLE,
  idle1: pose({ hip: [0, -29], neck: [2, -53], head: [3, -62], fe: [9, -45], fh: [14, -53], be: [-3, -43], bh: [5, -47] }),
  walk0: pose({ hip: [0, -30], fk: [9, -15], ff: [14, 0], bk: [-7, -14], bf: [-13, 0] }),
  walk1: pose({ hip: [0, -31], neck: [2, -55], head: [3, -64], fk: [5, -17], ff: [5, 0], bk: [-1, -16], bf: [-3, -3] }),
  walk2: pose({ hip: [0, -30], fk: [6, -16], ff: [8, -2], bk: [-4, -15], bf: [-7, 0] }),
  walk3: pose({ hip: [0, -31], neck: [2, -55], head: [3, -64], fk: [3, -16], ff: [1, 0], bk: [-2, -16], bf: [2, -3] }),
  jab0: pose({ neck: [1, -54], fe: [6, -47], fh: [10, -52] }),
  jab1: pose({
    hip: [2, -30], neck: [6, -53], head: [8, -62], fe: [16, -52], fh: [28, -53], be: [0, -45], bh: [6, -49],
    fk: [10, -15], ff: [15, 0], bk: [-6, -15], bf: [-11, 0],
  }),
  heavy0: pose({
    hip: [-1, -31], neck: [-4, -54], head: [-4, -63], fe: [4, -48], fh: [8, -55], be: [-9, -46], bh: [-12, -40],
    fk: [10, -36], ff: [4, -24], bk: [-3, -15], bf: [-4, 0],
  }),
  heavy1: pose({
    hip: [-2, -31], neck: [-8, -52], head: [-10, -60], fe: [-1, -47], fh: [4, -53], be: [-12, -44], bh: [-16, -38],
    fk: [12, -38], ff: [30, -46], bk: [-4, -15], bf: [-5, 0],
  }),
  upper0: pose({
    hip: [0, -22], neck: [4, -44], head: [6, -52], fe: [10, -34], fh: [9, -27], be: [-2, -36], bh: [4, -38],
    fk: [10, -12], ff: [12, 0], bk: [-8, -10], bf: [-12, 0],
  }),
  upper1: pose({
    hip: [2, -32], neck: [4, -57], head: [3, -66], fe: [12, -62], fh: [14, -78], be: [-4, -46], bh: [2, -50],
    fk: [8, -16], ff: [9, 0], bk: [-6, -12], bf: [-12, 0],
  }),
  hit0: pose({
    hip: [-2, -30], neck: [-8, -52], head: [-11, -60], fe: [-2, -44], fh: [4, -40], be: [-12, -46], bh: [-18, -42],
    fk: [4, -15], ff: [6, 0], bk: [-8, -14], bf: [-12, 0],
  }),
  hit1: pose({
    hip: [-1, -30], neck: [-5, -53], head: [-7, -61], fe: [3, -45], fh: [8, -44], be: [-8, -44], bh: [-12, -40],
    fk: [5, -15], ff: [7, 0], bk: [-7, -14], bf: [-11, 0],
  }),
  block: pose({
    hip: [-1, -29], neck: [-1, -53], head: [0, -62], fe: [7, -50], fh: [9, -63], be: [3, -46], bh: [9, -56],
    fk: [6, -14], ff: [8, 0], bk: [-8, -14], bf: [-12, 0],
  }),
  stumble0: pose({
    hip: [0, -28], neck: [8, -48], head: [13, -55], fe: [14, -40], fh: [20, -34], be: [4, -38], bh: [10, -30],
    fk: [8, -14], ff: [12, 0], bk: [-6, -18], bf: [-8, -6],
  }),
  stumble1: pose({
    hip: [-2, -29], neck: [-6, -52], head: [-8, -61], fe: [4, -58], fh: [10, -66], be: [-12, -56], bh: [-16, -64],
    fk: [4, -14], ff: [8, 0], bk: [-6, -16], bf: [-14, -4],
  }),
  fall0: pose({
    hip: [0, -30], neck: [-18, -44], head: [-26, -48], fe: [-10, -50], fh: [-4, -58], be: [-22, -38], bh: [-28, -33],
    fk: [10, -34], ff: [18, -37], bk: [6, -24], bf: [14, -20],
  }),
  fall1: pose({
    hip: [4, -5], neck: [-18, -6], head: [-27, -7], fe: [-12, -2], fh: [-4, -2], be: [-20, -11], bh: [-25, -3],
    fk: [14, -7], ff: [25, -3], bk: [12, -3], bf: [23, -1],
  }),
  kneel: pose({
    hip: [0, -16], neck: [5, -38], head: [8, -46], fe: [9, -27], fh: [11, -15], be: [1, -27], bh: [5, -13],
    fk: [10, -17], ff: [12, 0], bk: [-4, -3], bf: [-14, -1],
  }),
  win0: pose({ neck: [1, -55], head: [1, -64], fe: [8, -62], fh: [10, -75], be: [-6, -46], bh: [-3, -38] }),
  win1: pose({ neck: [1, -56], head: [1, -65], fe: [8, -64], fh: [10, -77], be: [-6, -47], bh: [-3, -39] }),
};

/* ------------------------------------------------------------------ */
/* Wing looks                                                          */
/* ------------------------------------------------------------------ */

type Gear = 'hood' | 'helm' | 'crest' | 'visor' | 'goggles' | 'plume' | 'hardhat' | 'horns' | 'antenna' | 'halo' | 'crown' | 'scarf';

interface Look { accent: string; gear: Gear; sigil: string[] }

export const LOOKS: Record<WingId, Look> = {
  questioners: { accent: '#f7e37c', gear: 'hood', sigil: ['.###.', '#...#', '..##.', '.....', '..#..'] },
  lawfinders: { accent: '#d8e4ff', gear: 'helm', sigil: ['..#..', '#####', '#.#.#', '..#..', '.###.'] },
  pattern_seers: { accent: '#f0b6ff', gear: 'crest', sigil: ['.###.', '#...#', '#.#.#', '#...#', '.###.'] },
  formalizers: { accent: '#c8f5d8', gear: 'visor', sigil: ['#.#.#', '.....', '#.#.#', '.....', '#.#.#'] },
  experimenters: { accent: '#9ef0ff', gear: 'goggles', sigil: ['.#.#.', '.#.#.', '#...#', '#####', '.###.'] },
  imaginers: { accent: '#ffd23f', gear: 'plume', sigil: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'] },
  builders: { accent: '#ffcf33', gear: 'hardhat', sigil: ['#####', '#####', '..#..', '..#..', '..#..'] },
  strategists: { accent: '#e6d3a3', gear: 'horns', sigil: ['..#..', '.###.', '#.#.#', '..#..', '..#..'] },
  mind_mappers: { accent: '#b8ffe4', gear: 'antenna', sigil: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] },
  awakeners: { accent: '#fff3b0', gear: 'halo', sigil: ['..#..', '.#.#.', '#.#.#', '#####', '.....'] },
  society_shapers: { accent: '#ffe08a', gear: 'crown', sigil: ['#...#', '#.#.#', '#####', '.....', '#####'] },
  artists: { accent: '#ffb3c1', gear: 'scarf', sigil: ['....#', '...#.', '..#..', '.#.#.', '#....'] },
};

function lum(c: string): number {
  const [r, g, b] = hex(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Index palette per wing. */
function paletteFor(wing: WingId): string[] {
  const { primary, secondary } = WINGS[wing].palette;
  const look = LOOKS[wing];
  const lightBody = lum(primary) > 0.72;
  const mask = lightBody ? '#6b5537' : '#e4d9c0';
  return [
    'rgba(0,0,0,0)', // 0
    '#0a0810', // 1 outline
    primary, // 2
    mix(primary, '#ffffff', 0.32), // 3
    mix(primary, '#000000', 0.42), // 4
    mix(secondary, '#ffffff', 0.08), // 5
    mix(secondary, '#ffffff', 0.28), // 6
    mix(secondary, '#000000', 0.35), // 7
    mask, // 8
    mix(mask, '#000000', 0.45), // 9
    mix(primary, '#ffffff', 0.7), // 10 eye glow
    '#cbbb9b', // 11 wraps
    '#877658', // 12 wraps dark
    look.accent, // 13
    mix(look.accent, '#000000', 0.45), // 14
  ];
}

/* ------------------------------------------------------------------ */
/* Rasterizer                                                          */
/* ------------------------------------------------------------------ */

class Buf {
  readonly d = new Uint8Array(SPR_W * SPR_H);
  set(x: number, y: number, v: number): void {
    const ix = Math.round(x) + ORIGIN_X;
    const iy = Math.round(y) + ORIGIN_Y;
    if (ix < 0 || iy < 0 || ix >= SPR_W || iy >= SPR_H) return;
    this.d[iy * SPR_W + ix] = v;
  }
  get(ix: number, iy: number): number {
    if (ix < 0 || iy < 0 || ix >= SPR_W || iy >= SPR_H) return 0;
    return this.d[iy * SPR_W + ix] ?? 0;
  }
  disc(cx: number, cy: number, r: number, v: number): void {
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy <= r * r + r * 0.6) this.set(cx + dx, cy + dy, v);
      }
    }
  }
  line(a: J, b: J, r0: number, v: number, r1 = r0): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r0 + (r1 - r0) * t, v);
    }
  }
  rect(x: number, y: number, w: number, h: number, v: number): void {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.set(x + xx, y + yy, v);
  }
  pattern(x: number, y: number, rows: string[], v: number): void {
    rows.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) if (row[xx] === '#') this.set(x + xx, y + yy, v);
    });
  }
}

function add(a: J, dx: number, dy: number): J {
  return [a[0] + dx, a[1] + dy];
}

function drawGear(b: Buf, gear: Gear, p: Pose, tick: number): void {
  const [hx, hy] = p.head;
  const hd = p.head;
  switch (gear) {
    case 'hood':
      b.disc(hx - 1, hy - 1, 7.2, 2);
      b.line(add(hd, -5, -2), add(hd, -10, 5), 2, 2);
      b.disc(hx + 1, hy + 1, 4.6, 8);
      b.rect(hx + 1, hy, 5, 2, 9);
      b.set(hx + 3, hy, 10);
      b.set(hx + 4, hy, 10);
      break;
    case 'helm':
      b.rect(hx - 6, hy - 7, 13, 5, 13);
      b.rect(hx - 7, hy - 3, 3, 7, 13);
      b.rect(hx + 3, hy - 3, 1, 5, 13);
      break;
    case 'crest':
      b.line(add(hd, 0, -6), add(hd, -4, -15), 1.4, 13, 0.6);
      b.line(add(hd, -2, -6), add(hd, -8, -12), 1, 2);
      b.pattern(hx + 1, hy - 5, ['.#.', '###', '.#.'], 13);
      break;
    case 'visor':
      b.rect(hx - 5, hy - 7, 11, 3, 2);
      b.rect(hx - 1, hy - 2, 8, 3, 13);
      for (let i = 0; i < 8; i += 2) b.set(hx - 1 + i, hy - 1, 14);
      break;
    case 'goggles':
      b.rect(hx - 6, hy - 2, 12, 2, 14);
      b.disc(hx + 3, hy - 1, 2.2, 13);
      b.set(hx + 3, hy - 1, 10);
      break;
    case 'plume': {
      const f = tick % 2;
      b.disc(hx - 1, hy - 7, 2.5, 13);
      b.line(add(hd, -1, -8), add(hd, -4 + f, -15), 1.6, 13, 0.5);
      b.line(add(hd, 1, -8), add(hd, 2 - f, -13), 1, 3, 0.4);
      b.set(hx - 3 + f, hy - 11, 10);
      break;
    }
    case 'hardhat':
      for (let dy = -8; dy <= -3; dy++) for (let dx = -7; dx <= 7; dx++) if (dx * dx + (dy + 2) * (dy + 2) <= 44) b.set(hx + dx, hy + dy, 13);
      b.rect(hx - 8, hy - 3, 17, 1, 14);
      b.rect(hx, hy - 8, 1, 5, 14);
      break;
    case 'horns':
      b.line(add(hd, -3, -5), add(hd, -8, -10), 1.3, 13, 1);
      b.line(add(hd, -8, -10), add(hd, -6, -16), 1, 13, 0.4);
      b.line(add(hd, 3, -5), add(hd, 8, -10), 1.3, 13, 1);
      b.line(add(hd, 8, -10), add(hd, 7, -16), 1, 13, 0.4);
      b.rect(hx - 5, hy - 5, 11, 2, 2);
      break;
    case 'antenna':
      b.line(add(hd, -1, -6), add(hd, -5, -14), 0.6, 14);
      b.disc(hx - 5, hy - 15, 1.4, 10);
      b.line(add(hd, 2, -6), add(hd, 4, -11), 0.6, 14);
      b.set(hx + 4, hy - 12, 13);
      b.set(hx - 3, hy + 2, 13);
      b.set(hx - 2, hy + 3, 13);
      break;
    case 'halo':
      b.disc(hx - 1, hy - 7, 2.4, 7);
      for (let dx = -6; dx <= 6; dx++) {
        const yy = Math.abs(dx) >= 5 ? 0 : 1;
        b.set(hx + dx, hy - 12 - (1 - yy), 13);
        if (Math.abs(dx) < 5) b.set(hx + dx, hy - 10 + 0, dx % 2 === 0 ? 13 : 0);
      }
      break;
    case 'crown':
      b.rect(hx - 6, hy - 5, 13, 2, 13);
      for (const dx of [-5, 0, 5]) b.line(add(hd, dx, -6), add(hd, dx, -9), 0.6, 13);
      b.set(hx, hy - 4, 10);
      break;
    case 'scarf': {
      const w = tick % 2 === 0 ? 0 : 1;
      b.line(add(p.neck, 1, 1), add(p.neck, -9, 4), 1.6, 13);
      b.line(add(p.neck, -9, 4), add(p.neck, -17, 2 + w), 1.4, 13, 0.8);
      b.line(add(p.neck, -8, 5), add(p.neck, -14, 9 - w), 1.1, 14, 0.6);
      b.line(add(hd, -3, -5), add(hd, -9, -13), 0.8, 3);
      break;
    }
  }
}

function rasterize(wing: WingId, name: FrameName, tick: number): Buf {
  const p = POSES[name];
  const b = new Buf();
  const look = LOOKS[wing];
  const lying = name === 'fall1';

  // Back leg + back arm (shadowed).
  b.line(p.hip, p.bk, 3, 7, 2.6);
  b.line(p.bk, p.bf, 2.6, 7, 2.2);
  b.rect(p.bf[0] - 2, p.bf[1] - 2, 6, 3, 1);
  b.line(p.neck, p.be, 2.2, 4, 1.8);
  b.line(p.be, p.bh, 1.7, 12, 1.5);
  b.disc(p.bh[0], p.bh[1], 2.4, 12);

  // Torso.
  b.line(p.hip, add(p.neck, 0, 2), 4, 2, 5.2);
  b.disc(p.neck[0], p.neck[1] + 3, 4, 2);
  // Belt + sash.
  b.line(add(p.hip, -4, -1), add(p.hip, 4, -1), 1.2, 5);
  b.set(p.hip[0] + 1, p.hip[1] - 1, 13);
  if (!lying) b.line(add(p.hip, 2, 0), add(p.hip, 4, 10), 1.3, 4, 0.8);

  // Chest sigil.
  const t = 0.4;
  const cx = Math.round(p.neck[0] + (p.hip[0] - p.neck[0]) * t);
  const cy = Math.round(p.neck[1] + (p.hip[1] - p.neck[1]) * t);
  if (!lying) b.pattern(cx - 2, cy - 2, look.sigil, 13);

  // Front leg.
  b.line(p.hip, p.fk, 3.1, 5, 2.7);
  b.line(p.fk, p.ff, 2.7, 5, 2.3);
  b.rect(p.ff[0] - 2, p.ff[1] - 2, 7, 3, 11);

  // Head: mask with eye slit, then headgear.
  b.disc(p.neck[0], p.neck[1] - 2, 2, 12);
  b.disc(p.head[0], p.head[1], 5.6, 8);
  const [hx, hy] = p.head;
  b.rect(hx, hy - 1, 6, 2, 9);
  b.set(hx + 3, hy - 1, 10);
  b.set(hx + 4, hy - 1, 10);
  for (let i = 0; i < 4; i += 2) b.set(hx + 1 + i, hy + 3, 9);
  drawGear(b, look.gear, p, tick);

  // Front arm on top.
  b.line(p.neck, p.fe, 2.4, 2, 2);
  b.line(p.fe, p.fh, 1.9, 11, 1.6);
  b.disc(p.fh[0], p.fh[1], 2.6, 11);

  shade(b);
  outline(b);
  return b;
}

const SHADE: Record<number, [number, number]> = { 2: [3, 4], 5: [6, 7], 8: [8, 9], 11: [11, 12], 13: [13, 14] };

function shade(b: Buf): void {
  const src = b.d.slice();
  for (let y = 0; y < SPR_H; y++) {
    for (let x = 0; x < SPR_W; x++) {
      const v = src[y * SPR_W + x] ?? 0;
      const s = SHADE[v];
      if (!s) continue;
      const up = y > 0 ? src[(y - 1) * SPR_W + x] : 0;
      const dn = y < SPR_H - 1 ? src[(y + 1) * SPR_W + x] : 0;
      const rt = x < SPR_W - 1 ? src[y * SPR_W + x + 1] : 0;
      if (up !== v && up !== s[0]) b.d[y * SPR_W + x] = s[0];
      else if (dn !== v || rt === 0) b.d[y * SPR_W + x] = s[1];
    }
  }
}

function outline(b: Buf): void {
  const src = b.d.slice();
  for (let y = 0; y < SPR_H; y++) {
    for (let x = 0; x < SPR_W; x++) {
      if ((src[y * SPR_W + x] ?? 0) !== 0) continue;
      const n = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= SPR_W || yy >= SPR_H ? 0 : src[yy * SPR_W + xx] ?? 0);
      const near = [n(x - 1, y), n(x + 1, y), n(x, y - 1), n(x, y + 1)].some((v) => v !== 0 && v !== 1);
      if (near) b.d[y * SPR_W + x] = 1;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Cache + public API                                                  */
/* ------------------------------------------------------------------ */

const cache = new Map<string, HTMLCanvasElement>();
const bufCache = new Map<string, Buf>();

function bufFor(wing: WingId, name: FrameName, tick: number): Buf {
  const key = `${wing}|${name}|${tick}`;
  let b = bufCache.get(key);
  if (!b) {
    b = rasterize(wing, name, tick);
    bufCache.set(key, b);
  }
  return b;
}

export function sprite(wing: WingId, name: FrameName, variant: Variant = 'normal', tick = 0): HTMLCanvasElement {
  const tk = tick % 2;
  const key = `${wing}|${name}|${variant}|${tk}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = bufFor(wing, name, tk);
  const pal = paletteFor(wing).map((c) => (c.startsWith('#') ? hex(c) : null));
  const c = document.createElement('canvas');
  c.width = SPR_W;
  c.height = SPR_H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SPR_W, SPR_H);
  for (let i = 0; i < b.d.length; i++) {
    const v = b.d[i] ?? 0;
    if (v === 0) continue;
    let rgb = pal[v] ?? [255, 0, 255];
    let a = 255;
    if (variant === 'white') rgb = v === 1 ? [40, 20, 30] : [255, 250, 240];
    else if (variant === 'glass') {
      const l = (rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11) / 255;
      rgb = v === 1 ? [200, 250, 255] : [Math.round(120 + l * 120), Math.round(190 + l * 60), 255];
      a = v === 1 ? 255 : 200;
    }
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = a;
  }
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

/** Filled pixels of a frame, relative to the feet origin (for shatter shards). */
export function spritePixels(wing: WingId, name: FrameName, step = 3): { x: number; y: number }[] {
  const b = bufFor(wing, name, 0);
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < SPR_H; y += step) {
    for (let x = 0; x < SPR_W; x += step) {
      if ((b.d[y * SPR_W + x] ?? 0) > 1) out.push({ x: x - ORIGIN_X, y: y - ORIGIN_Y });
    }
  }
  return out;
}

/**
 * Draw a fighter with its feet at (x, y). `facing` 1 = right, -1 = left.
 */
export function drawFighter(
  g: CanvasRenderingContext2D,
  wing: WingId,
  name: FrameName,
  x: number,
  y: number,
  facing: 1 | -1,
  variant: Variant = 'normal',
  tick = 0,
  scale = 1,
): void {
  const s = sprite(wing, name, variant, tick);
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(facing * scale, scale);
  g.drawImage(s, -ORIGIN_X, -ORIGIN_Y);
  g.restore();
}

/** Shadow ellipse under a fighter. */
export function drawShadow(g: CanvasRenderingContext2D, x: number, y: number, w = 26): void {
  g.fillStyle = 'rgba(0,0,0,0.45)';
  const rx = Math.round(x);
  g.fillRect(rx - w / 2, y - 1, w, 2);
  g.fillRect(rx - w / 2 + 3, y - 2, w - 6, 4);
}

export function wingAccent(wing: WingId): string {
  return LOOKS[wing].accent;
}
