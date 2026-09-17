/**
 * A tiny built-in pixel font (5 rows tall, variable width, uppercase).
 * Glyphs are rasterized once into a white atlas, then tinted per color and
 * cached, so drawing text is a handful of drawImage calls.
 */

const G: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  ' ': ['..', '..', '..', '..', '..'],
  '.': ['.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '#', '#'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  "'": ['#', '#', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...'],
  '-': ['...', '...', '###', '...', '...'],
  ':': ['.', '#', '.', '#', '.'],
  ';': ['.', '#', '.', '#', '#'],
  '(': ['.#', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '#.'],
  '[': ['##', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '##'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '=': ['...', '###', '...', '###', '...'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '$': ['.##', '##.', '.#.', '.##', '##.'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
  '#': ['#.#', '###', '#.#', '###', '#.#'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '_': ['...', '...', '...', '...', '###'],
  '*': ['...', '#.#', '.#.', '#.#', '...'],
  '|': ['#', '#', '#', '#', '#'],
  '^': ['.#.', '#.#', '...', '...', '...'],
  '~': ['....', '.#.#', '#.#.', '....', '....'],
  '▶': ['#..', '##.', '###', '##.', '#..'], // ▶
  '◀': ['..#', '.##', '###', '.##', '..#'], // ◀
  '▲': ['.....', '..#..', '.###.', '#####', '.....'], // ▲
  '▼': ['.....', '#####', '.###.', '..#..', '.....'], // ▼
  '•': ['..', '..', '##', '##', '..'], // •
};

const ALIAS: Record<string, string> = {
  '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"',
  '×': 'X', '…': '...', '→': '>', '@': 'A', '`': "'", '{': '(', '}': ')', '\\': '/',
};

export const GLYPH_H = 5;
export const LINE_H = 7;

interface GlyphInfo { x: number; w: number }
const glyphs = new Map<string, GlyphInfo>();
let atlas: HTMLCanvasElement | null = null;
const tinted = new Map<string, HTMLCanvasElement>();

function buildAtlas(): HTMLCanvasElement {
  const keys = Object.keys(G);
  const width = keys.reduce((s, k) => s + (G[k]![0]!.length + 1), 0);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = GLYPH_H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  let x = 0;
  for (const k of keys) {
    const rows = G[k]!;
    const w = rows[0]!.length;
    rows.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') g.fillRect(x + i, y, 1, 1);
    });
    glyphs.set(k, { x, w });
    x += w + 1;
  }
  return c;
}

function atlasFor(color: string): HTMLCanvasElement {
  if (!atlas) atlas = buildAtlas();
  let t = tinted.get(color);
  if (!t) {
    t = document.createElement('canvas');
    t.width = atlas.width;
    t.height = atlas.height;
    const g = t.getContext('2d')!;
    g.drawImage(atlas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, t.width, t.height);
    tinted.set(color, t);
  }
  return t;
}

/** Normalize arbitrary text to the glyph set (uppercase, aliases). */
export function normalize(text: string): string {
  let out = '';
  for (const ch of text.toUpperCase()) {
    const a = ALIAS[ch];
    if (a !== undefined) out += a;
    else if (G[ch]) out += ch;
    else if (/\s/.test(ch)) out += ' ';
    else out += '?';
  }
  return out;
}

export function measure(text: string, scale = 1): number {
  if (!atlas) atlas = buildAtlas();
  let w = 0;
  for (const ch of normalize(text)) w += (glyphs.get(ch)?.w ?? 3) + 1;
  return Math.max(0, w - 1) * scale;
}

export interface TextOpts {
  color?: string;
  scale?: number;
  shadow?: string | null;
  outline?: string | null;
  align?: 'left' | 'center' | 'right';
}

function drawRun(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale: number): void {
  const a = atlasFor(color);
  let cx = x;
  for (const ch of text) {
    const info = glyphs.get(ch);
    if (!info) { cx += 4 * scale; continue; }
    g.drawImage(a, info.x, 0, info.w, GLYPH_H, cx, y, info.w * scale, GLYPH_H * scale);
    cx += (info.w + 1) * scale;
  }
}

export function drawText(g: CanvasRenderingContext2D, raw: string, x: number, y: number, opts: TextOpts = {}): number {
  const text = normalize(raw);
  const scale = opts.scale ?? 1;
  const w = measure(text, scale);
  let sx = Math.round(x);
  if (opts.align === 'center') sx = Math.round(x - w / 2);
  else if (opts.align === 'right') sx = Math.round(x - w);
  const sy = Math.round(y);
  if (opts.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) {
      drawRun(g, text, sx + dx, sy + dy, opts.outline, scale);
    }
  }
  const shadow = opts.shadow === undefined ? '#000000' : opts.shadow;
  if (shadow) drawRun(g, text, sx + scale, sy + scale, shadow, scale);
  drawRun(g, text, sx, sy, opts.color ?? '#ffffff', scale);
  return w;
}

/** Word-wrap to a pixel width. */
export function wrap(raw: string, maxW: number, scale = 1): string[] {
  const words = normalize(raw).split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (measure(test, scale) <= maxW || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const bigCache = new Map<string, HTMLCanvasElement>();

/** Big banner text with a vertical metal gradient and a dark outline. */
export function bigText(raw: string, scale: number, top: string, bottom: string, outline = '#12080a'): HTMLCanvasElement {
  const key = `${raw}|${scale}|${top}|${bottom}|${outline}`;
  const hit = bigCache.get(key);
  if (hit) return hit;
  const text = normalize(raw);
  const w = measure(text, scale) + 4;
  const h = GLYPH_H * scale + 4;
  const face = document.createElement('canvas');
  face.width = w;
  face.height = h;
  const f = face.getContext('2d')!;
  f.imageSmoothingEnabled = false;
  drawRun(f, text, 2, 2, '#ffffff', scale);
  // Gradient built on its own canvas, then composited once (source-in is
  // unbounded: compositing band-by-band would erase the face).
  const grad = document.createElement('canvas');
  grad.width = w;
  grad.height = h;
  const gg = grad.getContext('2d')!;
  const bands = Math.max(2, GLYPH_H * scale);
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    gg.fillStyle = mix(top, bottom, t < 0.45 ? t * 0.6 : 0.27 + (t - 0.45) * 1.33);
    gg.fillRect(0, 2 + i, w, 1);
  }
  gg.fillStyle = 'rgba(255,255,255,0.55)';
  gg.fillRect(0, 2, w, Math.max(1, Math.floor(scale / 2)));
  f.globalCompositeOperation = 'source-in';
  f.drawImage(grad, 0, 0);
  const out = document.createElement('canvas');
  out.width = w + 2;
  out.height = h + 3;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 2], [0, 2], [2, 0], [1, 3], [2, 3]] as const) {
    drawRun(o, text, 2 + dx, 2 + dy, outline, scale);
  }
  o.drawImage(face, 1, 1);
  bigCache.set(key, out);
  return out;
}

export function mix(a: string, b: string, t: number): string {
  const pa = hex(a);
  const pb = hex(b);
  const k = Math.max(0, Math.min(1, t));
  const c = pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function hex(c: string): [number, number, number] {
  const s = c.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((x) => x + x).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
