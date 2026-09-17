/**
 * FightScreen: plays a precomputed MatchReplay back on the Stage.
 * Each exchange: the speaker's line types out in the Truth HUD while the
 * speaker closes distance; when the line lands, the verdict tag appears and
 * the combat event plays (within the same frame — juice tracks the judge).
 */

import { FALLACIES, opponent, type CombatEvent, type Genius, type MatchReplay, type Side, type TranscriptEntry } from '@vk/core';
import type { ArenaId } from './arenas.js';
import { integrityTimeline } from './data.js';
import type { Game, Screen } from './engine.js';
import { C, type Gfx } from './gfx.js';
import { drawTopHud, newHp, stepHp, TruthStrip, verdictTag, type HpState } from './hud.js';
import { TranscriptOverlay } from './pause.js';
import { Stage, wingColor, type Fighter } from './stage.js';

export interface FightOpts {
  replay: MatchReplay;
  fighters: Record<Side, Genius>;
  arena: ArenaId;
  title: string;
  onDone: (game: Game, replay: MatchReplay) => void;
}

type Phase = 'intro' | 'type' | 'act' | 'hold' | 'ending' | 'done';

const REACH: Record<string, number> = {
  jab: 40, heavy: 44, combo_hit: 40, launcher: 36, whiff: 58, labeled_block: 40, backfire: 48, guard: 0, finisher: 38,
};

export class FightScreen implements Screen {
  readonly name = 'fight';
  private stage!: Stage;
  private strip = new TruthStrip();
  private hp: Record<Side, HpState> = { A: newHp(), B: newHp() };
  private phase: Phase = 'intro';
  private phaseT = 0;
  private index = -1;
  private readonly timeline: Record<Side, number>[];
  private overlay = new TranscriptOverlay();
  private paused = false;
  private endT = 0;

  constructor(private readonly opts: FightOpts) {
    this.timeline = integrityTimeline(opts.replay);
  }

  /** Debug/test hook: how far the playback got. */
  get progress(): { index: number; phase: Phase; total: number } {
    return { index: this.index, phase: this.phase, total: this.opts.replay.entries.length };
  }

  enter(game: Game): void {
    this.stage = new Stage(game, this.opts.fighters.A, this.opts.fighters.B, this.opts.arena);
    this.stage.callout(this.stage.arenaName, 70, '#e8e0d0', '#7a6a8a', 2, this.opts.title);
  }

  exit(): void {
    this.overlay.hide();
  }

  private get entry(): TranscriptEntry | undefined {
    return this.opts.replay.entries[this.index];
  }

  update(game: Game): void {
    const inp = game.input;
    if (inp.pressed('pause') || (this.paused && (inp.pressed('back') || inp.pressed('start')))) {
      this.paused = !this.paused;
      if (this.paused) {
        this.overlay.show(this.opts.title, this.opts.replay.entries.slice(0, Math.max(0, this.index + 1)), this.opts.fighters);
      } else this.overlay.hide();
      return;
    }
    if (this.paused) return;
    if (inp.pressed('fast')) {
      game.fast = !game.fast;
      game.notify(game.fast ? 'FAST FORWARD 3X' : 'NORMAL SPEED');
    }
    if (inp.pressed('confirm')) {
      if (this.phase === 'type') this.strip.skip();
      else if (this.phase === 'ending' && this.endT > 60) this.finish(game);
    }
    const n = game.fast ? 3 : 1;
    for (let i = 0; i < n && this.phase !== 'done'; i++) this.step(game);
  }

  private step(game: Game): void {
    const s = this.stage;
    s.update();
    stepHp(this.hp.A);
    stepHp(this.hp.B);
    this.phaseT++;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT === 70) {
          s.callout('ARGUE!', 50, '#fff0a0', '#c02a08', 4);
          game.audio.announce('Argue!');
          game.audio.play('confirm');
        }
        if (this.phaseT >= 115) this.next();
        break;
      case 'type': {
        if (s.hitstop === 0) this.strip.step(1.5);
        if (this.strip.done && (!s.busy || this.phaseT > 240)) this.act(game);
        break;
      }
      case 'act':
        this.strip.step();
        if (this.phaseT > 20 && !s.busy) {
          this.syncHp();
          this.phase = 'hold';
          this.phaseT = 0;
        }
        if (this.phaseT > 400) this.next();
        break;
      case 'hold':
        this.strip.step();
        if (this.phaseT === 4 && !this.isOver()) s.spread();
        if (this.phaseT > 36) this.next();
        break;
      case 'ending':
        this.endT++;
        if (this.endT > 260) this.finish(game);
        break;
      case 'done':
        break;
    }
  }

  private isOver(): boolean {
    const hp = this.timeline[this.index];
    return !!hp && (hp.A <= 0 || hp.B <= 0);
  }

  private next(): void {
    if (this.isOver() || this.index + 1 >= this.opts.replay.entries.length) {
      this.startEnding();
      return;
    }
    this.index++;
    const e = this.entry!;
    const who = this.opts.fighters[e.argument.side];
    this.strip.say(who.name, wingColor(who), e.argument.text);
    const actor = this.stage.fighters[e.argument.side];
    const reach = REACH[e.combat[0]?.type ?? 'guard'] ?? 0;
    if (reach > 0 && !actor.ko) this.stage.approach(actor, reach);
    this.phase = 'type';
    this.phaseT = 0;
  }

  private syncHp(): void {
    const hp = this.timeline[this.index];
    if (!hp) return;
    this.hp.A.target = hp.A;
    this.hp.B.target = hp.B;
  }

  private damage(side: Side, amount: number): void {
    const floorHp = this.timeline[this.index]?.[side] ?? 0;
    this.hp[side].target = Math.max(floorHp, this.hp[side].target - amount);
  }

  private act(game: Game): void {
    const e = this.entry!;
    this.phase = 'act';
    this.phaseT = 0;
    this.strip.setTag(verdictTag(e.verdict, e.combat));
    for (const c of e.combat) this.playEvent(game, c);
  }

  private playEvent(game: Game, c: CombatEvent): void {
    const s = this.stage;
    const att: Fighter = s.fighters[c.actor];
    const def: Fighter = s.fighters[opponent(c.actor)];
    const tSide = opponent(c.actor);
    const fallacyName = (this.entry?.verdict.fallacies ?? [])
      .map((f) => FALLACIES[f]?.label ?? f.toUpperCase())
      .join(' + ') || 'FALLACY';
    const koAfter = (this.timeline[this.index]?.[tSide] ?? 1) <= 0;
    const maybeKo = () => {
      if (koAfter && c.type !== 'finisher' && !def.ko) {
        s.knockout(att, def);
        s.callout('POSITION BROKEN', 100, '#ffffff', '#b01010', 3);
        game.audio.announce('Position broken');
      }
    };
    switch (c.type) {
      case 'jab':
        s.jab(att, () => {
          this.damage(tSide, c.damage);
          if (c.label) s.label(c.label, def.x, 60, C.gold);
          maybeKo();
        });
        break;
      case 'heavy':
        s.heavy(att, () => {
          this.damage(tSide, c.damage);
          s.label(c.label ?? 'HEAVY', def.x, 60, C.gold);
          maybeKo();
        });
        break;
      case 'combo_hit': {
        const hits = Math.max(2, Math.min(4, c.combo));
        const per = c.damage / hits;
        s.combo(att, hits, (i) => {
          this.damage(tSide, per);
          if (i === hits - 1) {
            s.label(c.label ?? `${hits}-LINK CHAIN`, def.x, 56, C.gold, true);
            maybeKo();
          }
        });
        break;
      }
      case 'launcher':
        s.launcher(att, (k) => {
          this.damage(tSide, k === 0 ? c.damage * 0.7 : c.damage * 0.3);
          if (k === 0) {
            s.label(c.label ?? 'LAUNCHER', def.x, 56, C.sound, true);
            s.callout('SOUND!', 45, '#b0ffc0', '#1a7a3a', 3);
            game.audio.announce('Sound!');
          } else maybeKo();
        });
        break;
      case 'whiff':
        s.whiff(att, fallacyName);
        break;
      case 'labeled_block':
        s.labeledBlock(att, fallacyName);
        break;
      case 'backfire':
        s.backfire(att, fallacyName, () => this.damage(c.actor, c.selfDamage));
        break;
      case 'guard':
        s.guard(att);
        break;
      case 'finisher':
        s.finisher(att, () => {
          this.damage(tSide, c.damage);
          if (def.living) s.callout('POSITION SHATTERED', 110, '#e0fbff', '#2a7ab0', 3);
        });
        break;
    }
  }

  private startEnding(): void {
    this.phase = 'ending';
    this.phaseT = 0;
    this.endT = 0;
    this.syncHp();
    const s = this.stage;
    const w = this.opts.replay.winner;
    if (!w) {
      s.callout('DRAW', 150, '#e8e0d0', '#6a6a8a', 4);
      return;
    }
    const winner = s.fighters[w];
    const loser = s.fighters[opponent(w)];
    const byDecision = !loser.ko && !loser.hidden;
    s.tl.after(byDecision ? 10 : 50, () => {
      s.win(winner);
      if (byDecision) {
        loser.play('kneel');
        s.callout('DECISION', 70, '#e8e0d0', '#6a6a8a', 3);
        this.stage.sfx('ko');
      }
    });
    s.tl.after(byDecision ? 80 : 90, () => {
      s.callout(`${winner.genius.name} WINS`, 170, C.gold, '#9a3a0a', 2, 'THE POSITION HELD');
      this.stage.say(`${winner.genius.name} wins`);
    });
  }

  private finish(game: Game): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.opts.onDone(game, this.opts.replay);
  }

  render(g: Gfx, game: Game): void {
    this.stage.render(g);
    const total = this.opts.replay.entries.length;
    const counter = String(Math.max(0, this.index + 1)).padStart(2, '0');
    drawTopHud(g, this.opts.fighters, this.hp, counter, `OF ${total}`, game.tick, game.fast);
    this.strip.render(g, game.tick, 'P TRANSCRIPT - F FAST - ENTER SKIP - M MUTE');
  }
}
