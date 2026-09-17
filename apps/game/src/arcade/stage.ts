/**
 * Stage: two fighters, physics, animation, hitstop, particles, floating
 * labels and big callouts. The fight screen and the title attract mode both
 * drive it through high-level moves (jab, heavy, launcher, whiff, ...).
 */

import { WINGS, type Genius, type Side } from '@vk/core';
import { ARENA_NAMES, cameraFor, drawArena, WORLD_W, type ArenaId } from './arenas.js';
import type { Sfx } from './audio.js';
import type { Game } from './engine.js';
import { Timeline } from './engine.js';
import { bigText, mix } from './font.js';
import { C, W, blit, text, type Gfx } from './gfx.js';
import { FLOOR, Particles } from './particles.js';
import { drawFighter, drawShadow, spritePixels, type FrameName, type Variant } from './sprites.js';

type AnimName = 'idle' | 'walk' | 'jab' | 'heavy' | 'upper' | 'hit' | 'block' | 'guard' | 'stumble' | 'air' | 'down' | 'getup' | 'kneel' | 'win';

const ANIMS: Record<AnimName, { frames: [FrameName, number][]; loop?: boolean; hold?: boolean }> = {
  idle: { frames: [['idle0', 22], ['idle1', 22]], loop: true },
  walk: { frames: [['walk0', 6], ['walk1', 6], ['walk2', 6], ['walk3', 6]], loop: true },
  jab: { frames: [['jab0', 4], ['jab1', 10], ['idle0', 2]] },
  heavy: { frames: [['heavy0', 8], ['heavy1', 16], ['idle0', 2]] },
  upper: { frames: [['upper0', 8], ['upper1', 18], ['idle0', 2]] },
  hit: { frames: [['hit0', 7], ['hit1', 12]] },
  block: { frames: [['block', 28]] },
  guard: { frames: [['block', 44]] },
  stumble: { frames: [['stumble0', 9], ['stumble1', 9], ['stumble0', 8], ['stumble1', 8], ['hit1', 6]] },
  air: { frames: [['fall0', 1]], hold: true },
  down: { frames: [['fall1', 1]], hold: true },
  getup: { frames: [['kneel', 14], ['hit1', 6]] },
  kneel: { frames: [['kneel', 1]], hold: true },
  win: { frames: [['win0', 12], ['win1', 12]], loop: true },
};

export class Fighter {
  x: number;
  z = 0;
  vx = 0;
  vz = 0;
  facing: 1 | -1 = 1;
  anim: AnimName = 'idle';
  animT = 0;
  flash = 0;
  glass = 0;
  hidden = false;
  staggered = false;
  ko = false;
  walkTo: number | null = null;
  getupIn = 0;

  constructor(
    readonly side: Side,
    public genius: Genius,
    x: number,
  ) {
    this.x = x;
  }

  get wing() {
    return this.genius.wing;
  }

  get living(): boolean {
    return this.genius.living === true;
  }

  get airborne(): boolean {
    return this.z > 0 || this.vz > 0;
  }

  play(a: AnimName): void {
    this.anim = a;
    this.animT = 0;
  }

  frame(): FrameName {
    const def = ANIMS[this.anim];
    const total = def.frames.reduce((s, f) => s + f[1], 0);
    let t = def.loop ? this.animT % total : this.animT;
    for (const [name, d] of def.frames) {
      if (t < d) return name;
      t -= d;
    }
    return def.frames[def.frames.length - 1]![0];
  }

  get animDone(): boolean {
    const def = ANIMS[this.anim];
    if (def.loop || def.hold) return false;
    return this.animT >= def.frames.reduce((s, f) => s + f[1], 0);
  }

  /** Chest point in world space. */
  chest(): [number, number] {
    return [this.x + this.facing * 4, FLOOR - 46 - this.z];
  }
}

interface Label { text: string; x: number; y: number; color: string; life: number; max: number; big: boolean }
interface Callout { text: string; life: number; max: number; top: string; bottom: string; scale: number; sub?: string }

export class Stage {
  readonly fighters: Record<Side, Fighter>;
  readonly particles = new Particles();
  readonly tl = new Timeline();
  hitstop = 0;
  darken = 0;
  /** Attract mode: no sound, no shake, no callouts. */
  quiet = false;
  tick = 0;
  cam = 80;
  private labels: Label[] = [];
  private callouts: Callout[] = [];

  constructor(
    readonly game: Game,
    a: Genius,
    b: Genius,
    public arena: ArenaId,
  ) {
    this.fighters = { A: new Fighter('A', a, WORLD_W / 2 - 50), B: new Fighter('B', b, WORLD_W / 2 + 50) };
    this.fighters.B.facing = -1;
    this.cam = cameraFor(this.fighters.A.x, this.fighters.B.x);
    this.particles.onSplat = () => this.sfx('splat');
  }

  get arenaName(): string {
    return ARENA_NAMES[this.arena];
  }

  other(f: Fighter): Fighter {
    return f.side === 'A' ? this.fighters.B : this.fighters.A;
  }

  get busy(): boolean {
    if (this.tl.pending > 0 || this.hitstop > 0) return true;
    return (['A', 'B'] as const).some((s) => {
      const f = this.fighters[s];
      return f.airborne || (!f.ko && !f.hidden && !['idle', 'walk', 'kneel', 'win', 'down'].includes(f.anim)) || f.walkTo !== null;
    });
  }

  /* ---------------- feedback ---------------- */

  sfx(name: Sfx): void {
    if (!this.quiet) this.game.audio.play(name);
  }

  say(line: string): void {
    if (!this.quiet) this.game.audio.announce(line);
  }

  shake(mag: number, frames: number): void {
    if (!this.quiet) this.game.shake(mag, frames);
  }

  label(textStr: string, x: number, y: number, color: string, big = false): void {
    this.labels.push({ text: textStr, x, y, color, life: 0, max: big ? 90 : 60, big });
  }

  callout(textStr: string, frames = 70, top: string = C.gold, bottom = '#b0400a', scale = 4, sub?: string): void {
    if (this.quiet) return;
    this.callouts = this.callouts.filter((c) => c.scale !== scale);
    this.callouts.push({ text: textStr, life: 0, max: frames, top, bottom, scale, ...(sub !== undefined ? { sub } : {}) });
  }

  clearCallouts(): void {
    this.callouts = [];
  }

  private freeze(frames: number): void {
    this.hitstop = Math.max(this.hitstop, frames);
  }

  private bleed(f: Fighter, dir: number, n: number, power = 1): void {
    if (f.living) return; // presentation rule: no body gore for living figures
    const [x, y] = f.chest();
    this.particles.blood(x, y, dir, n, power);
  }

  private impact(att: Fighter, def: Fighter, power: 'light' | 'heavy' | 'huge', knock: number): void {
    const dir = att.facing;
    const [cx, cy] = def.chest();
    const hx = cx - dir * 6;
    const a = { play: (n: Sfx) => this.sfx(n) };
    if (power === 'light') {
      this.freeze(4);
      this.shake(1, 5);
      this.particles.sparks(hx, cy, dir, 8);
      this.bleed(def, dir, 8);
      a.play('hit');
    } else if (power === 'heavy') {
      this.freeze(9);
      this.shake(3, 10);
      this.particles.sparks(hx, cy, dir, 18, '#ffe070');
      this.bleed(def, dir, 26, 1.3);
      a.play('heavy');
    } else {
      this.freeze(14);
      this.shake(5, 16);
      this.particles.sparks(hx, cy, dir, 30, '#ffffff');
      this.bleed(def, dir, 40, 1.8);
      a.play('heavy');
    }
    def.flash = power === 'light' ? 4 : 8;
    def.vx = dir * knock;
    def.staggered = false;
    if (!def.airborne && !def.ko) def.play('hit');
  }

  approach(att: Fighter, reach: number): void {
    const def = this.other(att);
    const want = def.x - att.facing * reach;
    if (Math.abs(att.x - want) > 3 && (att.facing > 0 ? att.x < want : att.x > want)) att.walkTo = want;
  }

  spread(): void {
    const { A, B } = this.fighters;
    const mid = Math.max(110, Math.min(WORLD_W - 110, (A.x + B.x) / 2));
    const left = A.x <= B.x ? A : B;
    const right = left === A ? B : A;
    if (!left.ko && !left.hidden && !left.airborne) left.walkTo = mid - 46;
    if (!right.ko && !right.hidden && !right.airborne) right.walkTo = mid + 46;
  }

  /* ---------------- moves ---------------- */

  jab(att: Fighter, onHit?: () => void, power: 'light' | 'heavy' = 'light'): void {
    const def = this.other(att);
    att.walkTo = null;
    att.play('jab');
    att.vx = att.facing * 1.5;
    this.tl.after(4, () => {
      this.impact(att, def, power, power === 'light' ? 2.5 : 4);
      onHit?.();
    });
  }

  heavy(att: Fighter, onHit?: () => void): void {
    const def = this.other(att);
    att.walkTo = null;
    att.play('heavy');
    this.tl.after(8, () => {
      att.vx = att.facing * 1;
      this.impact(att, def, 'heavy', 6);
      onHit?.();
    });
  }

  combo(att: Fighter, hits: number, onHit: (i: number) => void): void {
    for (let i = 0; i < hits; i++) {
      this.tl.after(i * 14, () => {
        if (i === hits - 1) this.heavy(att, () => onHit(i));
        else this.jab(att, () => onHit(i));
        this.label(`${i + 1} HIT${i ? 'S' : ''}`, att.x - att.facing * 10, FLOOR - 88, C.gold);
      });
    }
  }

  launcher(att: Fighter, onHit: (stage: 0 | 1) => void): void {
    const def = this.other(att);
    att.walkTo = null;
    att.play('upper');
    this.tl.after(8, () => {
      this.impact(att, def, 'heavy', 2.2);
      def.vz = 6.2;
      def.z = 1;
      def.play('air');
      att.vx = att.facing * 1.5;
      onHit(0);
    });
    // Juggle follow-up while airborne.
    this.tl.after(30, () => {
      att.play('jab');
      att.vx = att.facing * 3.5;
      this.tl.after(4, () => {
        this.impact(att, def, 'light', 2.5);
        def.vz = Math.max(def.vz, 3);
        def.play('air');
        this.label('JUGGLE', def.x, FLOOR - 100 - def.z, C.cyan);
        onHit(1);
      });
    });
  }

  whiff(att: Fighter, name: string): void {
    const def = this.other(att);
    att.walkTo = null;
    def.vx = -att.facing * 3.2; // sidestep
    att.play('heavy');
    this.tl.after(7, () => {
      att.vx = att.facing * 3.5;
      this.sfx('whiff');
      this.particles.dust(att.x + att.facing * 20, FLOOR, 4);
      this.label('WHIFF', att.x + att.facing * 28, FLOOR - 70, C.grey);
    });
    this.tl.after(20, () => {
      att.play('stumble');
      att.staggered = true;
      this.fallacyFlash(att, name);
    });
  }

  labeledBlock(att: Fighter, name: string): void {
    const def = this.other(att);
    att.walkTo = null;
    def.play('block');
    att.play('jab');
    this.tl.after(4, () => {
      const [cx, cy] = def.chest();
      this.freeze(5);
      this.shake(1, 5);
      this.particles.sparks(cx - att.facing * 10, cy - 6, -att.facing, 12, C.block);
      this.sfx('block');
      att.vx = -att.facing * 2.5;
      def.vx = att.facing * 0.8;
      this.label(`${name}`, def.x, FLOOR - 104, C.fallacy, true);
      this.label('BLOCKED', def.x, FLOOR - 94, C.block);
    });
    this.tl.after(18, () => {
      att.staggered = true;
      this.fallacyFlash(att, null);
    });
  }

  backfire(att: Fighter, name: string, selfDamage: () => void): void {
    att.walkTo = null;
    att.play('heavy');
    this.tl.after(8, () => {
      this.sfx('backfire');
      att.play('stumble');
      att.vx = -att.facing * 3.2;
      att.flash = 6;
      this.particles.dust(att.x, FLOOR, 8);
      this.bleed(att, -att.facing, 6, 0.8);
      this.shake(2, 8);
      this.freeze(5);
      this.label('BACKFIRE', att.x, FLOOR - 94, '#ff9a3c');
      att.staggered = true;
      selfDamage();
      this.fallacyFlash(att, name);
    });
  }

  guard(f: Fighter): void {
    f.walkTo = null;
    f.play('guard');
    const [cx, cy] = f.chest();
    this.particles.sparks(cx + f.facing * 8, cy, f.facing, 4, C.block);
    this.label('GUARD', f.x, FLOOR - 92, C.block);
    this.sfx('block');
  }

  private fallacyFlash(att: Fighter, name: string | null): void {
    if (name) this.label(name, att.x, FLOOR - 104, C.fallacy, true);
    this.callout('FALLACY!', 50, '#ff8a7a', '#8a0a10', 3);
    this.say('Fallacy!');
  }

  /** Knock a fighter down for good (integrity at zero). */
  knockout(att: Fighter, def: Fighter): void {
    def.ko = true;
    def.vz = Math.max(def.vz, 5);
    def.z = Math.max(def.z, 1);
    def.vx = att.facing * 3;
    def.play('air');
    this.sfx('ko');
  }

  finisher(att: Fighter, onBreak: () => void): void {
    const def = this.other(att);
    att.walkTo = null;
    this.darken = 1;
    this.callout('POSITION BROKEN', 120, '#ffffff', '#b01010', 3);
    this.say('Position broken');
    this.tl.after(10, () => this.jab(att));
    this.tl.after(26, () => this.heavy(att));
    this.tl.after(48, () => {
      att.play('upper');
      this.tl.after(8, () => {
        if (def.living) {
          // Non-gore: the POSITION turns to glass and shatters.
          def.glass = 1;
          def.flash = 0;
          this.freeze(26);
          this.shake(2, 20);
          this.sfx('block');
          this.label('POSITION SHATTERED', def.x, FLOOR - 110, C.cyan, true);
          this.tl.after(2, () => {
            const pts = spritePixels(def.wing, def.frame(), 2);
            def.hidden = true;
            def.ko = true;
            this.particles.shards(pts, def.x, FLOOR - def.z, def.facing, att.facing * 1.2);
            this.sfx('shatter');
            this.shake(6, 24);
            onBreak();
          });
        } else {
          this.impact(att, def, 'huge', 4);
          this.particles.blood(def.chest()[0], def.chest()[1] - 8, att.facing, 50, 2.2);
          this.knockout(att, def);
          onBreak();
        }
      });
    });
    this.tl.after(90, () => {
      this.darken = 0;
    });
  }

  win(f: Fighter): void {
    f.walkTo = null;
    f.play('win');
  }

  /* ---------------- simulation ---------------- */

  update(): void {
    this.tick++;
    if (this.hitstop > 0) {
      this.hitstop--;
      for (const f of Object.values(this.fighters)) if (f.flash > 0 && this.tick % 2 === 0) f.flash--;
      return;
    }
    this.tl.step();
    for (const side of ['A', 'B'] as const) this.stepFighter(this.fighters[side]);
    // Keep bodies apart and inside the world.
    const { A, B } = this.fighters;
    const gap = B.x - A.x;
    if (Math.abs(gap) < 26 && !A.hidden && !B.hidden && !A.ko && !B.ko) {
      const push = (26 - Math.abs(gap)) / 2;
      const s = gap >= 0 ? 1 : -1;
      A.x -= push * s;
      B.x += push * s;
    }
    for (const f of [A, B]) f.x = Math.max(24, Math.min(WORLD_W - 24, f.x));
    if (!A.airborne && !B.airborne && !A.ko && !B.ko) {
      A.facing = A.x <= B.x ? 1 : -1;
      B.facing = A.x <= B.x ? -1 : 1;
    }
    const target = cameraFor(A.hidden ? B.x : A.x, B.hidden ? A.x : B.x);
    this.cam += (target - this.cam) * 0.1;
    this.particles.update();
    this.labels = this.labels.filter((l) => ++l.life < l.max);
    this.callouts = this.callouts.filter((c) => ++c.life < c.max);
    if (this.darken > 0 && this.tl.pending === 0) this.darken = Math.max(0, this.darken - 0.05);
  }

  private stepFighter(f: Fighter): void {
    f.animT++;
    if (f.flash > 0) f.flash--;
    // Walking.
    if (f.walkTo !== null && !f.airborne && (f.anim === 'idle' || f.anim === 'walk')) {
      const d = f.walkTo - f.x;
      if (Math.abs(d) <= 1.5) {
        f.x = f.walkTo;
        f.walkTo = null;
        f.play('idle');
      } else {
        if (f.anim !== 'walk') f.play('walk');
        f.x += Math.sign(d) * 1.5;
      }
    } else if (f.walkTo !== null && f.airborne) {
      f.walkTo = null;
    }
    // Physics.
    f.x += f.vx;
    if (f.airborne) {
      f.z += f.vz;
      f.vz -= 0.32;
      if (f.z <= 0) {
        f.z = 0;
        if (f.vz < -3.5) {
          f.vz = -f.vz * 0.35;
          f.z = 0.1;
          this.particles.dust(f.x, FLOOR, 8);
          this.shake(2, 6);
          this.sfx('hit');
        } else {
          f.vz = 0;
          f.play('down');
          this.particles.dust(f.x, FLOOR, 5);
          f.getupIn = f.ko ? 0 : 36;
        }
      }
      f.vx *= 0.98;
    } else {
      f.vx *= 0.8;
      if (Math.abs(f.vx) < 0.05) f.vx = 0;
    }
    if (f.anim === 'down' && f.getupIn > 0 && --f.getupIn === 0) f.play('getup');
    if (f.animDone) f.play('idle');
  }

  /* ---------------- rendering ---------------- */

  render(g: Gfx, drawFx = true): void {
    const cam = Math.round(this.cam);
    drawArena(g, this.arena, cam, this.tick);
    this.particles.drawPools(g, cam);
    const order = (['A', 'B'] as const).map((s) => this.fighters[s]).sort((a, b) => (a.anim === 'idle' ? -1 : 0) - (b.anim === 'idle' ? -1 : 0));
    for (const f of order) {
      if (f.hidden) continue;
      drawShadow(g, f.x - cam, FLOOR + 1, Math.max(10, 28 - f.z / 3));
    }
    if (this.darken > 0) {
      g.fillStyle = `rgba(20,0,0,${0.45 * this.darken})`;
      g.fillRect(0, 0, W, 176);
    }
    for (const f of order) this.drawOne(g, f, cam);
    this.particles.draw(g, cam);
    if (!drawFx) return;
    for (const l of this.labels) {
      const rise = Math.min(10, l.life * 0.4);
      const alpha = l.life > l.max - 12 ? (l.max - l.life) / 12 : 1;
      if (alpha <= 0) continue;
      g.globalAlpha = alpha;
      const pop = l.big && l.life < 8 ? 2 : 1;
      text(g, l.text, l.x - cam, l.y - rise, { align: 'center', color: l.color, scale: l.big ? pop : 1, outline: '#12080a' });
      g.globalAlpha = 1;
    }
    for (const c of this.callouts) {
      const img = bigText(c.text, c.scale, c.top, c.bottom);
      const t = c.life;
      const y = c.scale >= 4 ? 64 : 52;
      g.globalAlpha = t > c.max - 10 ? (c.max - t) / 10 : 1;
      if (t < 6) {
        const k = 1 + (6 - t) * 0.25;
        g.drawImage(img, Math.round(W / 2 - (img.width * k) / 2), Math.round(y - ((k - 1) * img.height) / 2), Math.round(img.width * k), Math.round(img.height * k));
      } else blit(g, img, W / 2, y);
      if (c.sub) text(g, c.sub, W / 2, y + img.height + 3, { align: 'center', color: C.white });
      g.globalAlpha = 1;
    }
  }

  private drawOne(g: Gfx, f: Fighter, cam: number): void {
    if (f.hidden) return;
    let frameName = f.frame();
    let x = f.x - cam;
    if (f.staggered && f.anim === 'idle') {
      x += Math.sin(this.tick * 0.45) * 1.5;
      if (Math.floor(this.tick / 10) % 2 === 0) frameName = 'hit1';
    }
    let variant: Variant = 'normal';
    if (f.glass > 0) variant = 'glass';
    else if (f.flash > 0 && f.flash % 2 === 0) variant = 'white';
    const y = FLOOR - Math.round(f.z);
    drawFighter(g, f.wing, frameName, x, y, f.facing, variant, Math.floor(this.tick / 8));
    if (f.glass > 0) {
      // Crack lines across the glass body.
      g.fillStyle = '#ffffff';
      const r = (n: number) => ((Math.sin(n * 91.7 + f.x) + 1) / 2);
      for (let i = 0; i < 5; i++) {
        let cx = x + (r(i) - 0.5) * 16;
        let cy = y - 20 - r(i + 3) * 40;
        for (let k = 0; k < 10; k++) {
          g.fillRect(Math.round(cx), Math.round(cy), 1, 1);
          cx += (r(i * 7 + k) - 0.5) * 4;
          cy += (r(i * 5 + k) - 0.5) * 4;
        }
      }
    }
    if (f.staggered && f.anim !== 'air' && this.tick % 20 < 10) {
      text(g, '*', x - 3, y - 80, { color: C.gold });
      text(g, '*', x + 3, y - 84, { color: C.gold });
    }
  }
}

export function wingColor(genius: Genius): string {
  return mix(WINGS[genius.wing].palette.primary, '#ffffff', 0.35);
}
