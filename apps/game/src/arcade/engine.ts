/**
 * Engine: fixed 60 Hz update, 320x224 offscreen buffer blitted with integer
 * scaling, screen transitions (fade), screen shake, global toggles.
 */

import { Audio } from './audio.js';
import { C, H, W, rect, text, type Gfx } from './gfx.js';
import { Input } from './input.js';

export interface Screen {
  readonly name: string;
  enter?(game: Game): void;
  exit?(game: Game): void;
  update(game: Game): void;
  render(g: Gfx, game: Game): void;
}

const STEP = 1000 / 60;
const FADE = 12;

export class Game {
  readonly buffer: HTMLCanvasElement;
  readonly g: Gfx;
  readonly dctx: CanvasRenderingContext2D;
  readonly input: Input;
  readonly audio = new Audio();
  tick = 0;
  /** Fast-forward fight playback 3x (F). */
  fast = false;
  private screen: Screen | null = null;
  private pending: Screen | null = null;
  private fade = 0;
  private fadeDir: 0 | 1 | -1 = 0;
  private shakeMag = 0;
  private shakeT = 0;
  private toast = '';
  private toastT = 0;
  private scale = 1;
  private acc = 0;
  private last = 0;
  /** Frame-time probe (ms) for the dev overlay. */
  frameMs = 0;

  constructor(private readonly display: HTMLCanvasElement) {
    this.buffer = document.createElement('canvas');
    this.buffer.width = W;
    this.buffer.height = H;
    this.g = this.buffer.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.dctx = display.getContext('2d')!;
    this.input = new Input(window);
    this.input.onFirstInput(() => this.audio.unlock());
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** The active screen (read-only probe for tests). */
  get current(): Screen | null {
    return this.screen;
  }

  get screenName(): string {
    return this.screen?.name ?? '';
  }

  private resize(): void {
    const k = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
    this.scale = k;
    this.display.width = W * k;
    this.display.height = H * k;
    this.display.style.width = `${W * k}px`;
    this.display.style.height = `${H * k}px`;
    this.dctx.imageSmoothingEnabled = false;
  }

  go(next: Screen, instant = false): void {
    if (!this.screen || instant) {
      this.swap(next);
      this.fade = instant ? 0 : FADE;
      this.fadeDir = instant ? 0 : -1;
      return;
    }
    this.pending = next;
    this.fadeDir = 1;
  }

  private swap(next: Screen): void {
    this.screen?.exit?.(this);
    this.screen = next;
    next.enter?.(this);
  }

  shake(mag: number, frames: number): void {
    if (mag >= this.shakeMag || this.shakeT <= 0) {
      this.shakeMag = mag;
      this.shakeT = frames;
    }
  }

  notify(msg: string): void {
    this.toast = msg;
    this.toastT = 90;
  }

  start(): void {
    const loop = (now: number) => {
      if (this.last === 0) this.last = now;
      this.acc += Math.min(250, now - this.last);
      this.last = now;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        const t0 = performance.now();
        this.update();
        this.frameMs = performance.now() - t0;
        this.acc -= STEP;
        steps++;
      }
      if (steps === 5) this.acc = 0;
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private update(): void {
    this.input.poll();
    this.tick++;
    if (this.input.pressed('mute')) {
      this.audio.unlock();
      this.audio.toggleMute();
      this.notify(this.audio.muted ? 'SOUND OFF' : 'SOUND ON');
    }
    if (this.fadeDir === 1) {
      this.fade++;
      if (this.fade >= FADE && this.pending) {
        this.swap(this.pending);
        this.pending = null;
        this.fadeDir = -1;
      }
    } else if (this.fadeDir === -1) {
      this.fade--;
      if (this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    // Screens only take input when not mid-transition.
    if (this.fadeDir !== 1) this.screen?.update(this);
    if (this.shakeT > 0) this.shakeT--;
    if (this.toastT > 0) this.toastT--;
  }

  private render(): void {
    const g = this.g;
    rect(g, 0, 0, W, H, C.bg);
    this.screen?.render(g, this);
    if (this.toastT > 0) text(g, this.toast, W - 4, 4, { align: 'right', color: C.gold });
    if (this.audio.muted) {
      rect(g, W - 12, H - 10, 3, 4, C.grey);
      rect(g, W - 9, H - 12, 2, 8, C.grey);
      text(g, 'X', W - 6, H - 11, { color: C.fallacy, shadow: null });
    }
    if (this.fade > 0) {
      g.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade / FADE)})`;
      g.fillRect(0, 0, W, H);
    }
    const k = this.scale;
    let dx = 0;
    let dy = 0;
    if (this.shakeT > 0) {
      const m = this.shakeMag * Math.min(1, this.shakeT / 6);
      dx = Math.round((Math.random() * 2 - 1) * m);
      dy = Math.round((Math.random() * 2 - 1) * m);
    }
    const d = this.dctx;
    d.fillStyle = '#000';
    d.fillRect(0, 0, W * k, H * k);
    d.imageSmoothingEnabled = false;
    d.drawImage(this.buffer, dx * k, dy * k, W * k, H * k);
  }
}

/** Simple frame-based scheduler used by stages and screens. */
export class Timeline {
  private t = 0;
  private items: { at: number; fn: () => void }[] = [];

  after(frames: number, fn: () => void): void {
    this.items.push({ at: this.t + Math.max(0, Math.round(frames)), fn });
  }

  get pending(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  step(): void {
    this.t++;
    const due = this.items.filter((i) => i.at <= this.t);
    if (due.length === 0) return;
    this.items = this.items.filter((i) => i.at > this.t);
    for (const d of due) d.fn();
  }
}
