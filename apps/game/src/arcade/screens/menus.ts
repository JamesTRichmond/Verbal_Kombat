/** TITLE (attract) → MODE SELECT → GENIUS SELECT. */

import { GENIUSES, WING_ORDER, WINGS, XP_PER_LEVEL, geniusesInWing, getGenius, lessonsForPrompt, type Genius } from '@vk/core';
import type { ArenaId } from '../arenas.js';
import type { Game, Screen } from '../engine.js';
import { bigText, measure, mix, wrap } from '../font.js';
import { careers } from '../careers.js';
import { C, H, W, bar, blink, blit, frame, rect, text, vgrad, type Gfx } from '../gfx.js';
import { startCouncil, startExhibition, toHall, toMode, toTitle } from '../flow.js';
import { Stage } from '../stage.js';
import { drawFighter, wingAccent } from '../sprites.js';
import { hint, portrait, tile } from './common.js';

const ATTRACT_ARENAS: ArenaId[] = ['garden', 'library', 'forge', 'observatory', 'warroom'];

function randomGenius(avoid?: string): Genius {
  let g: Genius;
  do g = GENIUSES[Math.floor(Math.random() * GENIUSES.length)]!;
  while (g.slug === avoid);
  return g;
}

export class TitleScreen implements Screen {
  readonly name = 'title';
  private stage!: Stage;
  private t = 0;
  private cycle = 0;
  private bouts = 0;

  enter(game: Game): void {
    this.bouts = careers.boutsFought();
    this.newBout(game);
  }

  private newBout(game: Game): void {
    const a = this.cycle === 0 ? getGenius('socrates') : randomGenius();
    const b = this.cycle === 0 ? getGenius('marie-curie') : randomGenius(a.slug);
    this.stage = new Stage(game, a, b, ATTRACT_ARENAS[this.cycle % ATTRACT_ARENAS.length]!);
    this.stage.quiet = true;
    this.cycle++;
  }

  update(game: Game): void {
    this.t++;
    const s = this.stage;
    s.update();
    if (this.t % 600 === 0) this.newBout(game);
    if (this.t % 46 === 0 && !s.busy) {
      const att = Math.random() < 0.5 ? s.fighters.A : s.fighters.B;
      const r = Math.random();
      s.approach(att, 40);
      s.tl.after(24, () => {
        if (r < 0.35) s.jab(att);
        else if (r < 0.55) s.heavy(att);
        else if (r < 0.7) s.labeledBlock(att, 'STRAWMAN');
        else if (r < 0.82) s.whiff(att, 'RED HERRING');
        else s.combo(att, 3, () => undefined);
      });
      s.tl.after(80, () => s.spread());
    }
    if (game.input.ok()) {
      game.audio.play('confirm');
      game.audio.announce('Verbal Kombat');
      toMode(game);
    }
  }

  render(g: Gfx, game: Game): void {
    this.stage.render(g, false);
    g.fillStyle = 'rgba(5,3,10,0.55)';
    g.fillRect(0, 0, W, H);
    vgrad(g, 0, 150, W, 74, 'rgba(0,0,0,0)', '#050308', 6);
    const logo1 = bigText('VERBAL', 5, '#fff3c0', '#b8740e');
    const logo2 = bigText('KOMBAT', 6, '#ff9a7a', '#7a0a10');
    const bob = Math.round(Math.sin(this.t * 0.05));
    blit(g, logo1, W / 2, 26 + bob);
    blit(g, logo2, W / 2, 56 + bob);
    rect(g, 70, 96, 180, 1, C.goldDark);
    text(g, 'EVERY BLOW IS AN ARGUMENT', W / 2, 101, { align: 'center', color: C.white });
    text(g, 'SOUND LOGIC LANDS. FALLACIES MISS.', W / 2, 110, { align: 'center', color: C.grey });
    if (blink(this.t, 28)) blit(g, bigText('PRESS START', 2, '#ffffff', '#f2c14e'), W / 2, 146);
    text(g, 'ENTER / SPACE / GAMEPAD START', W / 2, 166, { align: 'center', color: C.dim });
    text(g, `${GENIUSES.length} MINDS · ${this.bouts} BOUT${this.bouts === 1 ? '' : 'S'} FOUGHT`, W / 2, 182, { align: 'center', color: C.gold });
    if (!game.audio.ready) text(g, 'SOUND STARTS ON YOUR FIRST KEY - M TO MUTE', W / 2, 200, { align: 'center', color: C.grey });
    text(g, 'ORIGINAL CHARACTERS - METHODS, NEVER LIKENESSES', W / 2, 212, { align: 'center', color: C.dim });
  }
}

const MODES = [
  { id: 'exhibition', label: 'EXHIBITION', desc: ['PICK TWO LENSES FROM TWELVE WINGS.', 'THEY FIGHT OUT A SCRIPTED DEBATE:', '"FREE WILL IS AN ILLUSION."'] },
  { id: 'council', label: 'COUNCIL', desc: ['A 3-SEAT COUNCIL ANSWERS ONE PROBLEM.', 'EVERY SEAT FIGHTS EVERY OTHER SEAT.', 'THE CROWN GOES TO CALIBRATED EV.'] },
  { id: 'hall', label: 'HALL OF MINDS', desc: ['EVERY FIGHTER KEEPS A CAREER:', 'LEVELS, LESSONS, WARDS, AND A LOG', 'OF EVERY BOUT. EXPORT OR IMPORT IT.'] },
] as const;

const MODE_WINGS = [
  ['questioners', 'artists'],
  ['strategists', 'builders'],
  ['awakeners', 'experimenters'],
] as const;

export class ModeScreen implements Screen {
  readonly name = 'mode';
  private cursor = 0;
  private t = 0;

  update(game: Game): void {
    this.t++;
    const inp = game.input;
    const n = MODES.length;
    if (inp.pressed('up') || inp.pressed('left')) {
      this.cursor = (this.cursor + n - 1) % n;
      game.audio.play('move');
    }
    if (inp.pressed('down') || inp.pressed('right')) {
      this.cursor = (this.cursor + 1) % n;
      game.audio.play('move');
    }
    if (inp.pressed('back')) {
      game.audio.play('back');
      toTitle(game);
    } else if (inp.ok()) {
      game.audio.play('confirm');
      const id = MODES[this.cursor]!.id;
      if (id === 'exhibition') game.go(new SelectScreen());
      else if (id === 'council') startCouncil(game);
      else toHall(game);
    }
  }

  render(g: Gfx): void {
    vgrad(g, 0, 0, W, H, '#140a1c', '#05030a');
    blit(g, bigText('SELECT MODE', 3, '#fff3c0', '#b8740e'), W / 2, 14);
    MODES.forEach((m, i) => {
      const y = 36 + i * 58;
      const on = i === this.cursor;
      frame(g, 30, y, 260, 54, on ? '#2a1a30' : '#15121c', on ? (blink(this.t, 8) ? C.gold : C.goldDark) : C.panelEdge);
      blit(g, bigText(m.label, m.label.length > 10 ? 2 : 3, on ? '#ffffff' : '#9a90a8', on ? '#f2c14e' : '#5a5068'), 44, y + 6, 'left');
      m.desc.forEach((d, k) => text(g, d, 46, y + 28 + k * 8, { color: on ? C.white : C.grey }));
      if (on) text(g, '▶', 36, y + 10, { color: C.gold, scale: 2 });
      // Mini fighters.
      const wings = MODE_WINGS[i]!;
      g.save();
      g.beginPath();
      g.rect(32, y + 2, 256, 50);
      g.clip();
      drawFighter(g, wings[0], on ? 'jab1' : 'idle0', 232, y + 56, 1, 'normal', 0, 1);
      drawFighter(g, wings[1], on ? 'block' : 'idle0', 266, y + 56, -1, 'normal', 0, 1);
      g.restore();
    });
    hint(g, 'ARROWS MOVE - ENTER SELECT - ESC BACK');
  }
}

/* ------------------------------------------------------------------ */
/* Genius select                                                       */
/* ------------------------------------------------------------------ */

/** Truncate to a pixel width. */
export function fit(s: string, maxW: number): string {
  if (measure(s) <= maxW) return s;
  let t = s;
  while (t.length > 1 && measure(`${t}.`) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}.`;
}

const TILE_W = 25;
const TILE_X = (W - TILE_W * 12) / 2;
const LIST_ROWS = 9;

export class SelectScreen implements Screen {
  readonly name = 'select';
  private wing: number[] = [0, 11];
  private member: number[][] = [WING_ORDER.map(() => 0), WING_ORDER.map(() => 0)];
  private player = 0;
  private locked: (Genius | null)[] = [null, null];
  private t = 0;
  private lockT = 0;

  constructor() {
    const soc = geniusesInWing('questioners').findIndex((g) => g.slug === 'socrates');
    this.member[0]![0] = Math.max(0, soc);
  }

  private current(p: number): Genius {
    const wingId = WING_ORDER[this.wing[p]!]!;
    const list = geniusesInWing(wingId);
    return list[this.member[p]![this.wing[p]!]!] ?? list[0]!;
  }

  update(game: Game): void {
    this.t++;
    const inp = game.input;
    if (this.locked[0] && this.locked[1]) {
      this.lockT++;
      if (this.lockT > 50) startExhibition(game, this.locked[0], this.locked[1]);
      return;
    }
    const p = this.player;
    const w = this.wing[p]!;
    const list = geniusesInWing(WING_ORDER[w]!);
    const m = this.member[p]!;
    let moved = false;
    if (inp.pressed('left')) { this.wing[p] = (w + 11) % 12; moved = true; }
    if (inp.pressed('right')) { this.wing[p] = (w + 1) % 12; moved = true; }
    if (inp.pressed('up')) { m[w] = ((m[w] ?? 0) + list.length - 1) % list.length; moved = true; }
    if (inp.pressed('down')) { m[w] = ((m[w] ?? 0) + 1) % list.length; moved = true; }
    if (moved) game.audio.play('move');
    if (inp.ok()) {
      this.locked[p] = this.current(p);
      game.audio.play('confirm');
      game.audio.announce(this.current(p).name);
      if (p === 0) this.player = 1;
    } else if (inp.pressed('back')) {
      game.audio.play('back');
      if (p === 1) {
        this.player = 0;
        this.locked[0] = null;
      } else game.go(new ModeScreen());
    }
  }

  render(g: Gfx): void {
    vgrad(g, 0, 0, W, H, '#10081a', '#040208');
    const p = this.player;
    const g0 = this.locked[0] ?? this.current(0);
    const g1 = this.locked[1] ?? (p === 1 ? this.current(1) : null);
    const focus = p === 0 || !this.locked[1] ? this.current(p) : this.locked[1]!;
    const focusWing = WINGS[focus.wing];

    text(g, 'CHOOSE YOUR LENS', W / 2, 3, { align: 'center', color: C.gold, scale: 2 });
    // Wing tiles.
    WING_ORDER.forEach((wingId, i) => {
      const x = TILE_X + i * TILE_W;
      const y = 18;
      tile(g, wingId, x, y, TILE_W - 1, 28);
      portrait(g, wingId, x, y + 1, 1, 1);
      rect(g, x + 1, y + 23, TILE_W - 3, 4, 'rgba(0,0,0,0.55)');
      text(g, String(i + 1), x + 12, y + 23, { align: 'center', color: '#d0c8d8', shadow: null });
      const marks: [number, string][] = [[0, C.gold], [1, C.cyan]];
      for (const [pl, col] of marks) {
        const active = this.wing[pl] === i && (pl === p || this.locked[pl] !== null);
        if (!active) continue;
        if (pl === p && !blink(this.t, 6) && !this.locked[pl]) continue;
        g.strokeStyle = col;
        g.lineWidth = 1;
        g.strokeRect(x - 0.5 + pl, y - 0.5 + pl, TILE_W - pl * 2, 29 - pl * 2);
        text(g, pl === 0 ? '1P' : '2P', x + (pl === 0 ? 1 : 15), y + 30, { color: col });
      }
    });

    // Wing info.
    text(g, focusWing.name, W / 2, 56, { align: 'center', color: mix(focusWing.palette.primary, '#ffffff', 0.4), scale: 1 });
    text(g, `MOVE: ${focusWing.move}`, W / 2, 64, { align: 'center', color: C.white });
    text(g, `ASKS: ${focusWing.question}`, W / 2, 71, { align: 'center', color: C.grey });

    // Fighter panels.
    this.panel(g, 4, g0, 0);
    this.panel(g, W - 84, g1, 1);

    // Member list.
    const wingIdx = this.wing[p]!;
    const list = geniusesInWing(WING_ORDER[wingIdx]!);
    const sel = this.member[p]![wingIdx]!;
    frame(g, 90, 80, 140, 72, '#120e18');
    const start = Math.max(0, Math.min(list.length - LIST_ROWS, sel - Math.floor(LIST_ROWS / 2)));
    list.slice(start, start + LIST_ROWS).forEach((gn, k) => {
      const idx = start + k;
      const y = 84 + k * 7;
      const on = idx === sel;
      if (on) rect(g, 93, y - 1, 134, 7, p === 0 ? '#5a3a10' : '#10405a');
      const name = fit(gn.name, 100);
      text(g, name, 97, y, { color: on ? '#ffffff' : C.grey, shadow: null });
      if (gn.living) text(g, 'L', 203, y, { align: 'right', color: C.cyan, shadow: null });
      const lv = careers.get(gn.slug).level;
      text(g, `LV ${lv}`, 224, y, { align: 'right', color: lv > 1 ? C.gold : C.dim, shadow: null });
    });
    text(g, `${sel + 1}/${list.length}`, 226, 146, { align: 'right', color: C.dim, shadow: null });
    if (start > 0) text(g, '▲', 160, 76, { align: 'center', color: C.dim, shadow: null });

    // Info panel.
    frame(g, 4, 156, W - 8, 60, '#140f1c', p === 0 ? C.goldDark : '#2a6a8a');
    text(g, `${p === 0 ? '1P' : '2P'} ${focus.name}`, 10, 161, { color: p === 0 ? C.gold : C.cyan });
    const tags = [focus.living ? 'LIVING - NO GORE, FINISHERS SHATTER THE POSITION' : '', focus.contested ? 'CONTESTED LENS' : ''].filter(Boolean).join(' - ');
    if (tags) text(g, tags, W - 10, 161, { align: 'right', color: C.cyan });
    wrap(`METHOD: ${focus.method}`, W - 22).slice(0, 2).forEach((l, i) => text(g, l, 10, 169 + i * 7, { color: C.white }));
    const rec = careers.get(focus.slug);
    const r = rec.record;
    text(g, `LV ${rec.level}`, 10, 185, { color: C.gold });
    bar(g, 34, 185, 80, 5, (rec.xp - (rec.level - 1) * XP_PER_LEVEL) / XP_PER_LEVEL, C.cyan);
    text(g, `${rec.xp} XP`, 118, 185, { color: C.grey });
    text(g, `W-L-D ${r.wins}-${r.losses}-${r.draws}`, 170, 185, { color: C.white });
    text(g, `${rec.lessons.length} LESSONS`, W - 10, 185, { align: 'right', color: C.grey });
    const top = lessonsForPrompt(rec, { limit: 1 })[0];
    if (top) {
      wrap(`TOP LESSON: ${top}`, W - 22).slice(0, 2).forEach((l, i, arr) => {
        const more = i === arr.length - 1 && wrap(`TOP LESSON: ${top}`, W - 22).length > 2;
        text(g, more ? `${l}...` : l, 10, 194 + i * 7, { color: i === 0 ? C.sound : mix(C.sound, '#ffffff', 0.4) });
      });
    } else text(g, 'NO LESSONS YET - EVERY BOUT TEACHES. SIDE A: FREE WILL IS AN ILLUSION.', 10, 197, { color: C.dim });
    hint(g, this.locked[0] && this.locked[1] ? 'FIGHT!' : 'LEFT/RIGHT WING - UP/DOWN MEMBER - ENTER LOCK - ESC BACK');
  }

  private panel(g: Gfx, x: number, gn: Genius | null, pl: number): void {
    frame(g, x, 80, 80, 72, '#0c0a12', pl === 0 ? C.goldDark : '#2a6a8a');
    text(g, pl === 0 ? '1P - SIDE A' : '2P - SIDE B', x + 40, 83, { align: 'center', color: pl === 0 ? C.gold : C.cyan, shadow: null });
    if (!gn) {
      if (blink(this.t, 20)) text(g, 'WAITING', x + 40, 116, { align: 'center', color: C.dim });
      return;
    }
    const locked = this.locked[pl] !== null;
    rect(g, x + 10, 146, 60, 3, mix(WINGS[gn.wing].palette.primary, '#000000', 0.5));
    const frameName = locked ? (Math.floor(this.t / 12) % 2 ? 'win0' : 'win1') : Math.floor(this.t / 22) % 2 ? 'idle0' : 'idle1';
    // Clip the sprite to the panel.
    g.save();
    g.beginPath();
    g.rect(x + 2, 89, 76, 61);
    g.clip();
    drawFighter(g, gn.wing, frameName, x + 40, 148, pl === 0 ? 1 : -1, 'normal', Math.floor(this.t / 8));
    g.restore();
    if (locked) text(g, 'LOCKED', x + 40, 91, { align: 'center', color: wingAccent(gn.wing) });
  }
}
