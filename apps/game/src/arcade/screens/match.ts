/** VS screen and exhibition RESULT screen. */

import { WINGS, type Genius, type MatchReplay, type Side } from '@vk/core';
import { ARENA_NAMES, type ArenaId } from '../arenas.js';
import type { Game, Screen } from '../engine.js';
import { bigText, mix, wrap } from '../font.js';
import { C, H, W, blink, blit, frame, rect, text, vgrad, type Gfx } from '../gfx.js';
import { toTitle } from '../flow.js';
import { drawFighter } from '../sprites.js';
import { hint } from './common.js';
import { careers } from '../careers.js';

export interface VsOpts {
  A: Genius;
  B: Genius;
  stanceA: string;
  stanceB: string;
  title: string;
  arena: ArenaId;
  load: Promise<MatchReplay>;
  onReady: (game: Game, replay: MatchReplay) => void;
  onBack: (game: Game) => void;
}

export class VsScreen implements Screen {
  readonly name = 'vs';
  private t = 0;
  private replay: MatchReplay | null = null;
  private error = '';
  private gone = false;

  constructor(private readonly o: VsOpts) {
    o.load.then(
      (r) => (this.replay = r),
      (e: unknown) => (this.error = String(e)),
    );
  }

  enter(game: Game): void {
    game.audio.announce(`${this.o.A.name}. Versus. ${this.o.B.name}.`);
  }

  update(game: Game): void {
    this.t++;
    if (this.gone) return;
    const inp = game.input;
    if (inp.pressed('back')) {
      this.gone = true;
      game.audio.play('back');
      this.o.onBack(game);
      return;
    }
    if (this.t === 20) game.audio.play('heavy');
    if (this.replay && (this.t > 240 || (this.t > 30 && inp.ok()))) {
      this.gone = true;
      game.audio.play('confirm');
      this.o.onReady(game, this.replay);
    }
  }

  render(g: Gfx): void {
    const pa = WINGS[this.o.A.wing].palette;
    const pb = WINGS[this.o.B.wing].palette;
    const slide = Math.max(0, 40 - this.t * 3);
    // Diagonal split.
    for (let y = 0; y < H; y++) {
      const split = 150 + Math.round((H / 2 - y) * 0.25);
      rect(g, 0, y, split, 1, mix(pa.secondary, pa.primary, 0.25 + (y / H) * 0.2));
      rect(g, split, y, W - split, 1, mix(pb.secondary, pb.primary, 0.25 + (1 - y / H) * 0.2));
      if (y % 2 === 0) rect(g, split - 1, y, 3, 1, '#ffffff');
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    text(g, this.o.title, W / 2, 4, { align: 'center', color: C.white });
    const t = Math.floor(this.t / 12);
    drawFighter(g, this.o.A.wing, t % 2 ? 'idle0' : 'idle1', 70 - slide, 176, 1, 'normal', t, 2);
    drawFighter(g, this.o.B.wing, t % 2 ? 'idle1' : 'idle0', 250 + slide, 176, -1, 'normal', t, 2);
    const vs = bigText('VS', 7, '#ffffff', '#f2c14e', '#300008');
    const k = this.t < 20 ? 1 + (20 - this.t) * 0.08 : 1;
    g.drawImage(vs, Math.round(W / 2 - (vs.width * k) / 2), Math.round(70 - (vs.height * k) / 2), Math.round(vs.width * k), Math.round(vs.height * k));
    rect(g, 0, 170, W, 54, 'rgba(0,0,0,0.75)');
    this.side(g, 'A', 6, 'left');
    this.side(g, 'B', W - 6, 'right');
    text(g, ARENA_NAMES[this.o.arena], W / 2, 114, { align: 'center', color: C.white, outline: '#000000' });
    if (!this.replay) text(g, this.error ? `ERROR: ${this.error}` : 'JUDGING...', W / 2, 124, { align: 'center', color: C.gold });
    else if (blink(this.t, 16)) text(g, 'ENTER TO FIGHT', W / 2, 124, { align: 'center', color: C.gold, outline: '#000000' });
  }

  private side(g: Gfx, s: Side, x: number, align: 'left' | 'right'): void {
    const gn = s === 'A' ? this.o.A : this.o.B;
    const stance = s === 'A' ? this.o.stanceA : this.o.stanceB;
    const w = WINGS[gn.wing];
    const lv = careers.get(gn.slug).level;
    text(g, align === 'left' ? `${gn.name}  LV ${lv}` : `LV ${lv}  ${gn.name}`, x, 174, { align, color: '#ffffff', scale: 1 });
    text(g, `${w.name}${gn.living ? ' - LIVING' : ''}`, x, 181, { align, color: mix(w.palette.primary, '#ffffff', 0.45) });
    text(g, w.move, x, 188, { align, color: C.dim });
    wrap(`STANCE: ${stance}`, 150).slice(0, 4).forEach((l, i) => text(g, l, x, 196 + i * 7, { align, color: C.grey }));
  }
}

export class ResultScreen implements Screen {
  readonly name = 'result';
  private t = 0;

  constructor(
    private readonly replay: MatchReplay,
    private readonly fighters: Record<Side, Genius>,
    private readonly onNext: (game: Game) => void = toTitle,
  ) {}

  enter(game: Game): void {
    const w = this.replay.winner;
    if (w) game.audio.announce(`${this.fighters[w].name} wins`);
  }

  update(game: Game): void {
    this.t++;
    if (this.t > 30 && (game.input.ok() || game.input.pressed('back'))) {
      game.audio.play('confirm');
      this.onNext(game);
    }
  }

  render(g: Gfx): void {
    vgrad(g, 0, 0, W, H, '#1a0a0a', '#050208');
    const w = this.replay.winner;
    const winner = w ? this.fighters[w] : null;
    blit(g, bigText(winner ? 'WINNER' : 'DRAW', 4, '#fff3c0', '#b8740e'), W / 2, 6);
    if (winner && w) {
      text(g, winner.name, W / 2, 34, { align: 'center', color: C.white, scale: 2 });
      text(g, WINGS[winner.wing].name, W / 2, 48, { align: 'center', color: mix(WINGS[winner.wing].palette.primary, '#ffffff', 0.4) });
      const loser = this.fighters[w === 'A' ? 'B' : 'A'];
      rect(g, 20, 150, 90, 4, '#2a1a1a');
      drawFighter(g, winner.wing, Math.floor(this.t / 12) % 2 ? 'win0' : 'win1', 64, 150, 1, 'normal', Math.floor(this.t / 8));
      drawFighter(g, loser.wing, 'kneel', 262, 150, -1);
      rect(g, 220, 150, 90, 4, '#2a1a1a');
    }
    // Stats table.
    frame(g, 104, 60, 112, 100, '#140f1c');
    const rows: [string, (s: Side) => string][] = [
      ['INTEGRITY', (s) => String(Math.round(this.replay.finalIntegrity[s]))],
      ['ARGUMENTS', (s) => String(this.replay.stats[s].arguments)],
      ['CLEAN HITS', (s) => String(this.replay.stats[s].cleanHits)],
      ['FALLACIES', (s) => String(this.replay.stats[s].fallacies)],
      ['AVG SOUND', (s) => this.replay.stats[s].avgSoundness.toFixed(2)],
      ['DAMAGE', (s) => String(Math.round(this.replay.stats[s].totalDamageDealt))],
    ];
    text(g, 'A', 124, 66, { align: 'center', color: C.gold });
    text(g, 'B', 196, 66, { align: 'center', color: C.cyan });
    rows.forEach(([label, fn], i) => {
      const y = 78 + i * 13;
      if (i % 2 === 0) rect(g, 107, y - 3, 106, 11, '#1c1726');
      text(g, label, 160, y, { align: 'center', color: C.grey });
      text(g, fn('A'), 124, y, { align: 'center', color: C.white });
      text(g, fn('B'), 196, y, { align: 'center', color: C.white });
    });
    frame(g, 6, 164, W - 12, 42, '#120e18');
    const reason = !winner
      ? 'NEITHER POSITION BROKE.'
      : this.replay.finalIntegrity[w === 'A' ? 'B' : 'A'] <= 0
        ? `${this.fighters[w === 'A' ? 'B' : 'A'].name.toUpperCase()}'S POSITION WAS BROKEN BY SOUND REASONING.`
        : 'DECIDED ON REMAINING POSITION INTEGRITY.';
    wrap(reason, W - 24).forEach((l, i) => text(g, l, 12, 169 + i * 8, { color: C.white }));
    text(g, 'EVERY HIT TRACES TO A SENTENCE: PRESS P IN A FIGHT FOR THE TRANSCRIPT.', 12, 193, { color: C.dim });
    if (blink(this.t, 20)) hint(g, 'ENTER - WHAT THEY LEARNED');
  }
}
