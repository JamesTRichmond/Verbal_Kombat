/**
 * Particles: hit sparks, blood with gravity that pools on the floor, dust,
 * glass shards (the non-gore POSITION SHATTERED finisher), impact rings.
 * All coordinates are world space; draw() takes the camera offset.
 */

import { C } from './gfx.js';

export const FLOOR = 164;

type Kind = 'spark' | 'blood' | 'dust' | 'shard' | 'ring' | 'ember';

interface P {
  kind: Kind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number;
  color: string;
  grav: number;
}

interface Pool { x: number; w: number; age: number }

export class Particles {
  private list: P[] = [];
  private pools: Pool[] = [];
  onSplat: (() => void) | null = null;

  clear(): void {
    this.list = [];
    this.pools = [];
  }

  private add(p: P): void {
    if (this.list.length < 900) this.list.push(p);
  }

  sparks(x: number, y: number, dir: number, n: number, color: string = C.gold): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 2.2 + (dir > 0 ? 0 : Math.PI);
      const s = 1.5 + Math.random() * 3.5;
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: 0, max: 8 + Math.random() * 10, size: 1, color: Math.random() < 0.3 ? '#ffffff' : color, grav: 0.08 });
    }
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0, max: 10, size: 2, color: '#ffffff', grav: 0 });
  }

  blood(x: number, y: number, dir: number, n: number, power = 1): void {
    for (let i = 0; i < n; i++) {
      const s = (1 + Math.random() * 3) * power;
      this.add({
        kind: 'blood', x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4,
        vx: dir * s + (Math.random() - 0.5) * 1.5, vy: -1.5 - Math.random() * 3 * power,
        life: 0, max: 200, size: Math.random() < 0.45 ? 2 : 1,
        color: Math.random() < 0.35 ? C.bloodDark : C.blood, grav: 0.22,
      });
    }
  }

  dust(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'dust', x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.8, life: 0, max: 20 + Math.random() * 20, size: 2, color: '#a89c8a', grav: -0.01 });
    }
  }

  embers(x: number, y: number, n: number, color = '#ff9a3c'): void {
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'ember', x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 0.6, vy: -0.4 - Math.random() * 0.8, life: 0, max: 40 + Math.random() * 40, size: 1, color, grav: -0.005 });
    }
  }

  /** Break a sprite into glass shards. pts are sprite pixels relative to the feet. */
  shards(pts: { x: number; y: number }[], x: number, y: number, facing: number, push: number): void {
    for (const p of pts) {
      const px = x + p.x * facing;
      const py = y + p.y;
      const d = Math.hypot(p.x, p.y + 40) + 1;
      this.add({
        kind: 'shard', x: px, y: py,
        vx: push * (0.5 + Math.random() * 2.5) + (p.x * facing) / d * 2,
        vy: -1 - Math.random() * 3 + (p.y + 40) / d * 1.5,
        life: 0, max: 90 + Math.random() * 60, size: Math.random() < 0.5 ? 3 : 2,
        color: Math.random() < 0.3 ? '#ffffff' : Math.random() < 0.5 ? '#9ee8ff' : '#5fb8e0', grav: 0.18,
      });
    }
    for (let i = 0; i < 3; i++) this.add({ kind: 'ring', x, y: y - 40, vx: 0, vy: 0, life: -i * 4, max: 18, size: 3, color: '#bff4ff', grav: 0 });
  }

  update(): void {
    const keep: P[] = [];
    for (const p of this.list) {
      p.life++;
      if (p.life < 0) { keep.push(p); continue; }
      p.vy += p.grav;
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === 'spark') { p.vx *= 0.88; p.vy *= 0.88; }
      if ((p.kind === 'blood' || p.kind === 'shard') && p.y >= FLOOR + 2) {
        if (p.kind === 'blood') {
          this.pool(p.x, p.size);
          continue;
        }
        p.y = FLOOR + 2;
        p.vy *= -0.3;
        p.vx *= 0.6;
        if (Math.abs(p.vy) < 0.5) { p.vy = 0; p.grav = 0; p.vx *= 0.8; }
      }
      if (p.life < p.max) keep.push(p);
    }
    this.list = keep;
    for (const pool of this.pools) pool.age++;
  }

  private pool(x: number, size: number): void {
    const near = this.pools.find((q) => Math.abs(q.x - x) < q.w / 2 + 3);
    if (near) {
      near.w = Math.min(40, near.w + size * 0.6);
    } else if (this.pools.length < 50) {
      this.pools.push({ x, w: 2 + size, age: 0 });
    }
    if (Math.random() < 0.05) this.onSplat?.();
  }

  drawPools(g: CanvasRenderingContext2D, camX: number): void {
    for (const q of this.pools) {
      const x = Math.round(q.x - camX - q.w / 2);
      const w = Math.round(q.w);
      g.fillStyle = C.bloodDark;
      g.fillRect(x, FLOOR + 1, w, 2);
      g.fillRect(x + 2, FLOOR + 3, Math.max(1, w - 4), 1);
      g.fillStyle = C.blood;
      g.fillRect(x + 1, FLOOR + 1, Math.max(1, w - 3), 1);
      g.fillStyle = '#e04050';
      if (w > 5) g.fillRect(x + 2, FLOOR + 1, 1, 1);
    }
  }

  draw(g: CanvasRenderingContext2D, camX: number): void {
    for (const p of this.list) {
      if (p.life < 0) continue;
      const x = Math.round(p.x - camX);
      const y = Math.round(p.y);
      const k = 1 - p.life / p.max;
      g.fillStyle = p.color;
      switch (p.kind) {
        case 'spark': {
          g.fillRect(x, y, 1, 1);
          g.fillRect(Math.round(x - p.vx), Math.round(y - p.vy), 1, 1);
          if (k > 0.5) g.fillRect(x - 1, y, 3, 1);
          break;
        }
        case 'ring': {
          const r = Math.round(p.size + p.life * 1.6);
          g.globalAlpha = Math.max(0, k);
          g.fillRect(x - r, y, 2, 1);
          g.fillRect(x + r - 1, y, 2, 1);
          g.fillRect(x, y - r, 1, 2);
          g.fillRect(x, y + r - 1, 1, 2);
          const d = Math.round(r * 0.7);
          g.fillRect(x - d, y - d, 1, 1);
          g.fillRect(x + d, y - d, 1, 1);
          g.fillRect(x - d, y + d, 1, 1);
          g.fillRect(x + d, y + d, 1, 1);
          g.globalAlpha = 1;
          break;
        }
        case 'dust':
        case 'ember':
          g.globalAlpha = Math.max(0, k);
          g.fillRect(x, y, p.size, p.size);
          g.globalAlpha = 1;
          break;
        case 'shard':
          g.globalAlpha = Math.min(1, k * 3);
          g.fillRect(x, y, p.size, p.size - 1);
          g.fillStyle = '#ffffff';
          g.fillRect(x, y, 1, 1);
          g.globalAlpha = 1;
          break;
        case 'blood':
          g.fillRect(x, y, p.size, p.size + (p.vy > 2 ? 1 : 0));
          break;
      }
    }
  }
}
