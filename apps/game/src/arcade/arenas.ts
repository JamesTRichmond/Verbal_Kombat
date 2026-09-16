/**
 * Procedural parallax arenas, keyed by wing family. Static layers are
 * rendered once into canvases; flames, stars, embers and petals animate live.
 */

import type { WingId } from '@vk/core';
import { mix } from './font.js';
import { rect, rng, vgrad, dither, W } from './gfx.js';
import { FLOOR } from './particles.js';

export type ArenaId = 'library' | 'observatory' | 'forge' | 'warroom' | 'garden';

export const ARENA_NAMES: Record<ArenaId, string> = {
  library: 'THE LECTURE HALL',
  observatory: 'THE OBSERVATORY',
  forge: 'THE FORGE',
  warroom: 'THE WAR ROOM',
  garden: 'THE STONE GARDEN',
};

export const ARENA_FOR_WING: Record<WingId, ArenaId> = {
  questioners: 'library', formalizers: 'library', mind_mappers: 'library',
  lawfinders: 'observatory', pattern_seers: 'observatory', imaginers: 'observatory',
  experimenters: 'forge', builders: 'forge',
  strategists: 'warroom', society_shapers: 'warroom',
  awakeners: 'garden', artists: 'garden',
};

export const WORLD_W = 480;
const VIEW_H = 176;

interface Layers { back: HTMLCanvasElement; mid: HTMLCanvasElement; floor: HTMLCanvasElement }

const PAR = { back: 0.25, mid: 0.6, floor: 1 };

function layer(factor: number, h = VIEW_H): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W + (WORLD_W - W) * factor);
  c.height = h;
  const g = c.getContext('2d')!;
  return [c, g];
}

const built = new Map<ArenaId, Layers>();

function build(id: ArenaId): Layers {
  const [back, b] = layer(PAR.back);
  const [mid, m] = layer(PAR.mid);
  const [floor, f] = layer(PAR.floor);
  const r = rng(id.length * 7919 + id.charCodeAt(0));
  const bw = back.width;
  const mw = mid.width;
  const fw = floor.width;

  switch (id) {
    case 'library': {
      vgrad(b, 0, 0, bw, VIEW_H, '#140b1c', '#2a1830');
      for (let x = 20; x < bw; x += 70) {
        rect(b, x, 20, 30, 80, '#0c0812');
        vgrad(b, x + 2, 22, 26, 76, '#3d5f93', '#1c2a4a', 8);
        rect(b, x + 14, 22, 2, 76, '#0c0812');
        rect(b, x + 2, 55, 26, 2, '#0c0812');
        b.fillStyle = '#0c0812';
        for (let i = 0; i < 13; i++) b.fillRect(x + i, 20 - Math.round(Math.sqrt(169 - (i - 13) ** 2) * 0.9), 30 - 2 * i, 1);
        dither(b, x + 2, 22, 26, 30, 'rgba(180,210,255,0.25)', 4);
      }
      rect(b, 0, 104, bw, 3, '#0c0812');
      // Shelves.
      for (let x = 0; x < mw; x += 64) {
        rect(m, x, 60, 56, 90, '#2b1709');
        rect(m, x + 2, 62, 52, 86, '#170c05');
        for (let row = 0; row < 4; row++) {
          const y = 64 + row * 21;
          let bx = x + 3;
          while (bx < x + 52) {
            const w = 2 + Math.floor(r() * 3);
            const h = 12 + Math.floor(r() * 6);
            const col = ['#6b2a2a', '#2f4a6b', '#6b5a2a', '#2a5a3f', '#4a2a5a', '#8a7050'][Math.floor(r() * 6)]!;
            rect(m, bx, y + 18 - h, w, h, col);
            rect(m, bx, y + 18 - h, 1, h, mix(col, '#ffffff', 0.25));
            bx += w + (r() < 0.15 ? 2 : 0);
          }
          rect(m, x + 2, y + 18, 52, 2, '#3b2410');
        }
        // Column.
        rect(m, x + 56, 40, 8, 110, '#3a2e3c');
        rect(m, x + 56, 40, 2, 110, '#5a4a5c');
        rect(m, x + 54, 38, 12, 4, '#4a3e4c');
      }
      vgrad(f, 0, 146, fw, 30, '#2b1d1a', '#140c0a', 6);
      for (let y = 146, row = 0; y < 176; y += 5 + row, row++) {
        for (let x = (row % 2) * 10; x < fw; x += 20) rect(f, x, y, 10, 5 + row, 'rgba(255,220,180,0.06)');
      }
      rect(f, 0, 146, fw, 1, '#4a3428');
      rect(f, 120, 156, 240, 12, '#5a1418');
      rect(f, 120, 156, 240, 1, '#8a2a2a');
      dither(f, 122, 158, 236, 8, '#3a0a0e', 4);
      break;
    }
    case 'observatory': {
      vgrad(b, 0, 0, bw, VIEW_H, '#05030f', '#1b1440');
      for (let i = 0; i < 160; i++) rect(b, Math.floor(r() * bw), Math.floor(r() * 120), 1, 1, r() < 0.2 ? '#ffffff' : '#8a90c0');
      dither(b, 40, 30, 90, 40, 'rgba(160,90,200,0.35)', 3);
      b.fillStyle = '#e8e4d0';
      for (let dy = -14; dy <= 14; dy++) {
        const w = Math.round(Math.sqrt(196 - dy * dy));
        b.fillRect(bw - 60 - w, 40 + dy, w * 2, 1);
      }
      rect(b, bw - 66, 34, 4, 3, '#c8c4b0');
      rect(b, bw - 56, 44, 5, 4, '#c8c4b0');
      // Dome ribs.
      m.fillStyle = '#0d0a1e';
      for (let x = 0; x < mw; x++) {
        const t = x / mw;
        const top = Math.round(20 + 60 * (1 - Math.sin(t * Math.PI)));
        if (x % 48 < 4) m.fillRect(x, top, 1, VIEW_H - top);
      }
      for (let x = 0; x < mw; x++) {
        const t = x / mw;
        m.fillRect(x, Math.round(12 + 60 * (1 - Math.sin(t * Math.PI))), 1, 6);
      }
      // Telescope.
      const tx = Math.floor(mw * 0.62);
      for (let i = 0; i < 70; i++) rect(m, tx + i, 110 - Math.round(i * 0.8), 10 - Math.floor(i / 14), 10, i % 12 < 2 ? '#8a6a2a' : '#3a3450');
      rect(m, tx - 6, 108, 20, 42, '#2a2440');
      rect(m, tx - 10, 146, 28, 4, '#4a4466');
      // Orrery rings.
      m.fillStyle = '#b08a3a';
      for (let a = 0; a < 64; a++) {
        const th = (a / 64) * Math.PI * 2;
        m.fillRect(Math.round(60 + Math.cos(th) * 22), Math.round(96 + Math.sin(th) * 8), 1, 1);
        m.fillRect(Math.round(60 + Math.cos(th) * 12), Math.round(96 + Math.sin(th) * 4), 1, 1);
      }
      rect(m, 58, 94, 5, 5, '#f2c14e');
      rect(m, 59, 99, 2, 51, '#6a5a3a');
      vgrad(f, 0, 146, fw, 30, '#2a2838', '#0e0c16', 6);
      f.fillStyle = '#4a4660';
      for (let x = 0; x < fw; x++) {
        const ry = Math.round(Math.sqrt(Math.max(0, 1 - ((x - fw / 2) / 200) ** 2)) * 10);
        f.fillRect(x, 160 - ry, 1, 1);
        f.fillRect(x, 160 + Math.round(ry * 0.8), 1, 1);
      }
      rect(f, 0, 146, fw, 1, '#5a5678');
      break;
    }
    case 'forge': {
      vgrad(b, 0, 0, bw, VIEW_H, '#0e0806', '#4a1a08');
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(r() * bw);
        const y = Math.floor(r() * 110);
        rect(b, x, y, 6 + Math.floor(r() * 16), 3 + Math.floor(r() * 5), mix('#1a0e0a', '#3a1a0e', r()));
      }
      for (let x = 30; x < bw; x += 55) {
        for (let y = 0; y < 60 + (x % 30); y += 4) rect(b, x + (y % 8 === 0 ? 0 : 1), y, 2, 3, '#2a2220');
      }
      // Furnaces.
      for (let x = 20; x < mw; x += 110) {
        rect(m, x, 70, 60, 80, '#2a1c18');
        rect(m, x + 2, 70, 56, 2, '#4a3a30');
        for (let yy = 74; yy < 150; yy += 8) for (let xx = x + (yy % 16 === 2 ? 0 : 6); xx < x + 58; xx += 12) rect(m, xx, yy, 11, 7, '#34241e');
        rect(m, x + 14, 100, 32, 30, '#0a0402');
        vgrad(m, x + 16, 102, 28, 26, '#ffcc4a', '#c02a08', 6);
        rect(m, x + 22, 40, 16, 30, '#1e1612');
      }
      // Pipes + gear.
      rect(m, 0, 52, mw, 5, '#3a3a40');
      rect(m, 0, 52, mw, 1, '#6a6a72');
      m.fillStyle = '#4a4038';
      for (let a = 0; a < 90; a++) {
        const th = (a / 90) * Math.PI * 2;
        const rr = a % 10 < 5 ? 16 : 13;
        m.fillRect(Math.round(mw - 70 + Math.cos(th) * rr), Math.round(100 + Math.sin(th) * rr), 2, 2);
      }
      vgrad(f, 0, 146, fw, 30, '#2a2220', '#0a0605', 6);
      for (let x = 0; x < fw; x += 8) rect(f, x, 146, 1, 30, '#15100e');
      for (let y = 150; y < 176; y += 6) rect(f, 0, y, fw, 1, '#15100e');
      rect(f, 0, 146, fw, 1, '#ff7a2a');
      // Anvil.
      rect(f, 210, 132, 40, 6, '#3a3a44');
      rect(f, 204, 132, 8, 3, '#3a3a44');
      rect(f, 220, 138, 20, 8, '#2a2a30');
      rect(f, 210, 132, 40, 1, '#8a8a9a');
      break;
    }
    case 'warroom': {
      vgrad(b, 0, 0, bw, VIEW_H, '#2a0608', '#d0582a');
      b.fillStyle = '#3a0c10';
      for (let x = 0; x < bw; x++) b.fillRect(x, Math.round(90 + Math.sin(x * 0.05) * 10 + Math.sin(x * 0.013) * 14), 1, 80);
      b.fillStyle = '#1e0608';
      for (let x = 0; x < bw; x++) b.fillRect(x, Math.round(110 + Math.sin(x * 0.09 + 1) * 6), 1, 80);
      // Window frames.
      for (let x = 0; x < mw; x += 90) {
        rect(m, x, 0, 18, 150, '#1a0a0a');
        rect(m, x + 2, 0, 2, 150, '#3a1a14');
        // Banner.
        rect(m, x + 34, 12, 22, 60, '#8b1e1e');
        rect(m, x + 34, 12, 22, 2, '#c9a227');
        m.fillStyle = '#8b1e1e';
        for (let i = 0; i < 11; i++) m.fillRect(x + 34 + i, 72, 1, 11 - i), m.fillRect(x + 55 - i, 72, 1, 11 - i);
        rect(m, x + 42, 30, 6, 6, '#c9a227');
        rect(m, x + 44, 36, 2, 14, '#c9a227');
        rect(m, x + 38, 42, 14, 2, '#c9a227');
        // Torch bracket.
        rect(m, x + 72, 70, 4, 14, '#3a2a1a');
        rect(m, x + 70, 68, 8, 3, '#5a4a3a');
      }
      rect(m, 0, 120, mw, 30, '#1a0a0a');
      // Map table.
      rect(m, mw / 2 - 60, 118, 120, 8, '#4a2a14');
      rect(m, mw / 2 - 58, 116, 116, 3, '#b89a6a');
      dither(m, mw / 2 - 56, 116, 112, 2, '#6a8a5a', 3);
      rect(m, mw / 2 - 54, 126, 6, 24, '#2a1608');
      rect(m, mw / 2 + 48, 126, 6, 24, '#2a1608');
      vgrad(f, 0, 146, fw, 30, '#3a2014', '#140a06', 6);
      for (let y = 146; y < 176; y += 5) rect(f, 0, y, fw, 1, '#1e0e08');
      for (let x = 0; x < fw; x += 37) rect(f, x, 146, 1, 30, '#1e0e08');
      rect(f, 0, 146, fw, 1, '#6a3a24');
      break;
    }
    case 'garden': {
      vgrad(b, 0, 0, bw, VIEW_H, '#1c3a4a', '#f0a878');
      b.fillStyle = '#ffe6b0';
      for (let dy = -12; dy <= 12; dy++) {
        const w = Math.round(Math.sqrt(144 - dy * dy));
        b.fillRect(80 - w, 70 + dy, w * 2, 1);
      }
      b.fillStyle = '#6a6a88';
      for (let x = 0; x < bw; x++) b.fillRect(x, Math.round(96 + Math.abs(((x * 0.7) % 80) - 40) * 0.6), 1, 80);
      // Tiered temple silhouette.
      const tx = bw - 90;
      b.fillStyle = '#3a3050';
      for (let tier = 0; tier < 4; tier++) {
        const y = 60 + tier * 16;
        const w = 30 + tier * 10;
        for (let i = 0; i < 4; i++) b.fillRect(tx - w / 2 - i * 2, y + i, w + i * 4, 1);
        b.fillRect(tx - w / 2 + 6, y + 4, w - 12, 12);
      }
      b.fillRect(tx - 1, 48, 2, 12);
      // Trees with blossoms.
      for (let x = 10; x < mw; x += 120) {
        m.fillStyle = '#2a1a18';
        for (let i = 0; i < 70; i++) m.fillRect(x + 20 + Math.round(Math.sin(i * 0.08) * 6), 150 - i, 5, 1);
        for (let i = 0; i < 30; i++) m.fillRect(x + 22 + i, 90 - Math.round(i * 0.5), 2, 1);
        for (let k = 0; k < 90; k++) {
          const px = x + Math.floor(r() * 70) - 10;
          const py = 40 + Math.floor(r() * 50);
          rect(m, px, py, 3, 2, r() < 0.5 ? '#f4b6c8' : r() < 0.5 ? '#ffe0ea' : '#c87898');
        }
      }
      // Stone lanterns.
      for (let x = 80; x < mw; x += 150) {
        rect(m, x, 126, 4, 24, '#7a7a7a');
        rect(m, x - 5, 122, 14, 4, '#8a8a8a');
        rect(m, x - 3, 114, 10, 8, '#6a6a6a');
        rect(m, x - 1, 116, 6, 4, '#ffd27a');
        rect(m, x - 7, 110, 18, 4, '#8a8a8a');
      }
      vgrad(f, 0, 146, fw, 30, '#5a6a4a', '#1a2a1a', 6);
      for (let x = 0; x < fw; x += 18) rect(f, x, 150 + ((x / 18) % 2) * 2, 16, 8, '#8a8a80');
      for (let x = 0; x < fw; x += 18) rect(f, x, 150 + ((x / 18) % 2) * 2, 16, 1, '#b0b0a4');
      dither(f, 0, 146, fw, 3, '#3a5a2a', 2);
      rect(f, 0, 146, fw, 1, '#6a8a4a');
      break;
    }
  }
  return { back, mid, floor };
}

export function drawArena(g: CanvasRenderingContext2D, id: ArenaId, camX: number, tick: number): void {
  let L = built.get(id);
  if (!L) {
    L = build(id);
    built.set(id, L);
  }
  g.drawImage(L.back, -Math.round(camX * PAR.back), 0);
  g.drawImage(L.mid, -Math.round(camX * PAR.mid), 0);
  animate(g, id, camX, tick);
  g.drawImage(L.floor, -Math.round(camX * PAR.floor), 0);
}

function flame(g: CanvasRenderingContext2D, x: number, y: number, tick: number, seed: number): void {
  const f = (Math.sin(tick * 0.35 + seed) + 1) / 2;
  const h = 5 + Math.round(f * 3);
  rect(g, x - 2, y - h + 3, 5, h - 2, '#c02a08');
  rect(g, x - 1, y - h, 3, h, '#ff9a2a');
  rect(g, x, y - h + 2, 1, h - 3, '#fff0a0');
  g.fillStyle = 'rgba(255,160,60,0.08)';
  g.fillRect(x - 10, y - 14, 21, 20);
}

function animate(g: CanvasRenderingContext2D, id: ArenaId, camX: number, tick: number): void {
  const mx = -camX * PAR.mid;
  const bx = -camX * PAR.back;
  switch (id) {
    case 'library':
      for (let x = 0; x < 320 + 160; x += 64) {
        rect(g, Math.round(mx + x + 60), 32, 1, 6, '#e8e0c0');
        flame(g, Math.round(mx + x + 60), 32, tick, x);
      }
      g.fillStyle = 'rgba(255,240,200,0.5)';
      for (let i = 0; i < 12; i++) {
        const px = (i * 53 + tick * 0.2) % 360;
        g.fillRect(Math.round(px - 20), Math.round(40 + ((i * 37 + tick * 0.1) % 90)), 1, 1);
      }
      break;
    case 'observatory':
      for (let i = 0; i < 14; i++) {
        if ((tick + i * 17) % 50 < 6) {
          const x = Math.round(bx + ((i * 97) % 380));
          const y = (i * 31) % 100 + 6;
          rect(g, x - 1, y, 3, 1, '#ffffff');
          rect(g, x, y - 1, 1, 3, '#ffffff');
        }
      }
      if (tick % 400 < 30) {
        const t = (tick % 400) / 30;
        rect(g, Math.round(260 - t * 120), Math.round(10 + t * 30), 3, 1, '#ffffff');
        rect(g, Math.round(263 - t * 120), Math.round(9 + t * 30), 5, 1, 'rgba(255,255,255,0.4)');
      }
      break;
    case 'forge':
      for (let x = 20; x < 480; x += 110) {
        const f = (Math.sin(tick * 0.2 + x) + 1) / 2;
        g.fillStyle = `rgba(255,${120 + Math.round(f * 80)},40,${0.25 + f * 0.25})`;
        g.fillRect(Math.round(mx + x + 16), 102, 28, 26);
        g.fillStyle = `rgba(255,120,40,${0.05 + f * 0.05})`;
        g.fillRect(Math.round(mx + x - 10), 80, 80, 70);
      }
      g.fillStyle = '#ffb040';
      for (let i = 0; i < 20; i++) {
        const y = 150 - ((tick * (0.5 + (i % 3) * 0.3) + i * 23) % 140);
        const x = Math.round(mx + (i * 41) % 400 + Math.sin(tick * 0.05 + i) * 4);
        g.fillRect(x, Math.round(y), 1, 1);
      }
      break;
    case 'warroom':
      for (let x = 0; x < 480; x += 90) flame(g, Math.round(mx + x + 74), 68, tick, x);
      break;
    case 'garden': {
      for (let x = 80; x < 480; x += 150) {
        const f = (Math.sin(tick * 0.1 + x) + 1) / 2;
        g.fillStyle = `rgba(255,210,120,${0.1 + f * 0.1})`;
        g.fillRect(Math.round(mx + x - 8), 108, 20, 18);
      }
      for (let i = 0; i < 16; i++) {
        const y = ((tick * 0.4 + i * 29) % 190) - 10;
        const x = ((i * 67 + tick * 0.3) % 360) - 20 + Math.sin(tick * 0.05 + i) * 6;
        rect(g, Math.round(x), Math.round(y), 2, 1, i % 2 ? '#ffd0dc' : '#f49ab4');
      }
      break;
    }
  }
}

/** Screen-space camera for a pair of fighters. */
export function cameraFor(xa: number, xb: number): number {
  const mid = (xa + xb) / 2;
  return Math.max(0, Math.min(WORLD_W - W, mid - W / 2));
}

export { FLOOR };
