/** COUNCIL: LADDER → (VS → FIGHT → EV BOARD) × bouts → CROWN. */

import { SKEPTICAL_PRIOR, WINGS, getGenius, type ProposalScore } from '@vk/core';
import type { CouncilPlay } from '../data.js';
import { evSnapshot } from '../data.js';
import type { Game, Screen } from '../engine.js';
import { bigText, mix, wrap } from '../font.js';
import { C, H, W, bar, blink, blit, frame, rect, text, vgrad, type Gfx } from '../gfx.js';
import { councilBout, toTitle } from '../flow.js';
import { drawFighter } from '../sprites.js';
import { crown, fmt, hint, portrait, tile } from './common.js';

function nameOf(slug: string): string {
  return getGenius(slug).name;
}

/** EV bars are drawn on a fixed scale: 0.5 EV = full bar. */
const EV_SCALE = 0.5;

export class LadderScreen implements Screen {
  readonly name = 'ladder';
  private play: CouncilPlay | null = null;
  private error = '';
  private t = 0;

  constructor(
    load: Promise<CouncilPlay>,
    private readonly nextBout = 0,
  ) {
    load.then(
      (p) => (this.play = p),
      (e: unknown) => (this.error = String(e)),
    );
  }

  enter(game: Game): void {
    game.audio.announce('The council convenes');
  }

  update(game: Game): void {
    this.t++;
    const inp = game.input;
    if (inp.pressed('back')) {
      game.audio.play('back');
      toTitle(game);
      return;
    }
    if (this.play && this.t > 20 && inp.ok()) {
      game.audio.play('confirm');
      councilBout(game, this.play, this.nextBout);
    }
  }

  render(g: Gfx): void {
    vgrad(g, 0, 0, W, H, '#0c1020', '#040208');
    blit(g, bigText('THE COUNCIL', 3, '#fff3c0', '#b8740e'), W / 2, 3);
    if (!this.play) {
      text(g, this.error ? `ERROR: ${this.error}` : 'SEATING THE COUNCIL...', W / 2, 100, { align: 'center', color: C.gold });
      return;
    }
    const play = this.play;
    wrap(`PROBLEM: ${play.problem}`, W - 16).forEach((l, i) => text(g, l, W / 2, 24 + i * 7, { align: 'center', color: C.white }));
    const scores = evSnapshot(play, 0);
    const loud = [...scores].sort((a, b) => b.claimedEV - a.claimedEV)[0]?.seat;
    play.result.proposals.forEach((p, i) => {
      const y = 40 + i * 44;
      const gn = getGenius(p.seat);
      const sc = scores[i]!;
      frame(g, 4, y, W - 8, 42, '#120e1a', p.seat === loud ? '#8a3a2a' : C.panelEdge);
      tile(g, gn.wing, 8, y + 4, 28, 30);
      portrait(g, gn.wing, 9, y + 5, 1, 1);
      text(g, gn.name, 40, y + 5, { color: mix(WINGS[gn.wing].palette.primary, '#ffffff', 0.45) });
      text(g, `${WINGS[gn.wing].name}${gn.living ? ' - LIVING' : ''}`, 40 + 4 * gn.name.length + 8, y + 5, { color: C.dim });
      wrap(p.answer, 200).slice(0, 3).forEach((l, k) => text(g, l, 40, y + 14 + k * 7, { color: C.white }));
      text(g, 'CLAIMED EV', 250, y + 5, { color: C.grey });
      text(g, fmt(sc.claimedEV), 312, y + 14, { align: 'right', color: C.gold, scale: 2 });
      bar(g, 250, y + 28, 60, 6, sc.claimedEV / EV_SCALE, C.gold);
      if (p.seat === loud && blink(this.t, 20)) text(g, 'LOUDEST CLAIM', 250, y + 36, { color: C.fallacy, shadow: null });
    });
    frame(g, 4, 173, W - 8, 38, '#0e0b14');
    text(g, 'ROUND ROBIN', 10, 177, { color: C.gold });
    play.bouts.forEach((b, i) => {
      const done = i < this.nextBout;
      const cur = i === this.nextBout;
      const col = done ? C.dim : cur ? (blink(this.t, 10) ? C.white : C.gold) : C.grey;
      text(g, `${done ? 'DONE' : cur ? '▶' : ' '} BOUT ${i + 1}: ${b.A.name} VS ${b.B.name}`, 10, 185 + i * 8, { color: col });
    });
    text(g, 'EV = SUM OF P X MATTERS, SCORED ON JAMES\'S DRAFT VALUE PROFILE', W / 2, 214, { align: 'center', color: C.dim });
  }
}

export class EvBoardScreen implements Screen {
  readonly name = 'evboard';
  private t = 0;
  private readonly before: ProposalScore[];
  private readonly after: ProposalScore[];

  constructor(
    private readonly play: CouncilPlay,
    private readonly played: number,
  ) {
    this.before = evSnapshot(play, played - 1);
    this.after = evSnapshot(play, played);
  }

  update(game: Game): void {
    this.t++;
    if (this.t === 30) game.audio.play('block');
    if (this.t > 40 && game.input.ok()) {
      game.audio.play('confirm');
      if (this.played >= this.play.bouts.length) game.go(new CrownScreen(this.play));
      else game.go(new LadderScreen(Promise.resolve(this.play), this.played));
    } else if (game.input.pressed('back')) toTitle(game);
  }

  render(g: Gfx): void {
    vgrad(g, 0, 0, W, H, '#081418', '#030608');
    blit(g, bigText('EV BOARD', 3, '#c0fff0', '#1a8a6a'), W / 2, 3);
    const bout = this.play.bouts[this.played - 1]!;
    const w = bout.replay.winner;
    const winner = w === 'A' ? bout.A : w === 'B' ? bout.B : null;
    const loser = w === 'A' ? bout.B : w === 'B' ? bout.A : null;
    const broke = loser && bout.replay.finalIntegrity[w === 'A' ? 'B' : 'A'] <= 0;
    text(g, `AFTER BOUT ${this.played}/${this.play.bouts.length}`, W / 2, 23, { align: 'center', color: C.grey });
    text(
      g,
      winner && loser ? (broke ? `${winner.name} BROKE ${loser.name}'S POSITION` : `${winner.name} TOOK THE DECISION OVER ${loser.name}`) : 'NO DECISION',
      W / 2,
      31,
      { align: 'center', color: C.white },
    );
    const k = Math.min(1, Math.max(0, (this.t - 30) / 50));
    const lerp = (a: number, b: number) => a + (b - a) * (1 - (1 - k) ** 3);
    const ranked = [...this.after].sort((a, b) => b.calibratedEV - a.calibratedEV).map((s) => s.seat);
    text(g, 'CLAIMED', 150, 42, { color: C.gold });
    text(g, 'CREDIBILITY', 202, 42, { color: C.cyan });
    text(g, 'CALIBRATED EV', 256, 42, { color: C.sound });
    this.after.forEach((a, i) => {
      const b = this.before[i]!;
      const y = 50 + i * 42;
      const gn = getGenius(a.seat);
      const inBout = gn.slug === bout.A.slug || gn.slug === bout.B.slug;
      frame(g, 4, y, W - 8, 40, inBout ? '#122028' : '#0e1216', inBout ? '#2a6a7a' : '#2a3038');
      tile(g, gn.wing, 8, y + 5, 28, 30);
      portrait(g, gn.wing, 9, y + 6, 1, 1);
      text(g, String(ranked.indexOf(a.seat) + 1), 42, y + 6, { color: C.gold, scale: 2 });
      text(g, 'RANK', 40, y + 18, { color: C.dim });
      text(g, gn.name, 60, y + 6, { color: C.white });
      const fights = this.play.bouts.slice(0, this.played).filter((x) => x.A.slug === a.seat || x.B.slug === a.seat).length;
      text(g, `${fights} BOUT${fights === 1 ? '' : 'S'} FOUGHT`, 60, y + 14, { color: C.dim });
      const cred = lerp(b.credibility, a.credibility);
      const cal = lerp(b.calibratedEV, a.calibratedEV);
      // Claimed.
      bar(g, 150, y + 24, 46, 6, a.claimedEV / EV_SCALE, C.gold);
      text(g, fmt(a.claimedEV), 150, y + 16, { color: C.gold });
      // Credibility.
      bar(g, 202, y + 24, 46, 6, cred, cred < 0.3 ? C.fallacy : C.cyan);
      text(g, cred.toFixed(2), 202, y + 16, { color: C.cyan });
      if (Math.abs(a.credibility - b.credibility) > 0.005 && k >= 1) {
        const up = a.credibility > b.credibility;
        text(g, up ? '▲' : '▼', 244, y + 15, { color: up ? C.sound : C.fallacy, shadow: null });
      }
      // Calibrated.
      bar(g, 256, y + 24, 56, 6, cal / EV_SCALE, C.sound);
      text(g, fmt(cal, 3), 256, y + 16, { color: C.sound });
    });
    frame(g, 4, 178, W - 8, 30, '#0a0e12');
    text(g, "C = CREDIBILITY EARNED IN THE FIGHTS (UNFOUGHT SEATS STAY AT 0.50)", 10, 183, { color: C.grey });
    text(g, `P' = C*P + (1-C)*${SKEPTICAL_PRIOR}    M' = C*M    EV = SUM P'*M'`, 10, 192, { color: C.white });
    text(g, 'BROKEN POSITIONS REGRESS TOWARD DOUBT AND CANNOT VOUCH FOR THEIR STAKES.', 10, 200, { color: C.dim });
    if (k >= 1 && blink(this.t, 20)) hint(g, this.played >= this.play.bouts.length ? 'ENTER - THE COUNCIL DECIDES' : 'ENTER - NEXT BOUT');
  }
}

export class CrownScreen implements Screen {
  readonly name = 'crown';
  private t = 0;

  constructor(private readonly play: CouncilPlay) {}

  enter(game: Game): void {
    game.audio.announce('The council decides');
    game.audio.play('heavy');
  }

  update(game: Game): void {
    this.t++;
    if (this.t > 40 && (game.input.ok() || game.input.pressed('back'))) {
      game.audio.play('confirm');
      toTitle(game);
    }
  }

  render(g: Gfx): void {
    vgrad(g, 0, 0, W, H, '#20140a', '#050302');
    // Light rays.
    g.fillStyle = 'rgba(255,220,120,0.05)';
    for (let i = 0; i < 7; i++) {
      const a = this.t * 0.004 + i * 0.9;
      for (let r = 0; r < 120; r += 2) g.fillRect(Math.round(48 + Math.cos(a) * r), Math.round(110 + Math.sin(a) * r), 2, 2);
    }
    const v = this.play.result.verdict;
    const champ = v.champion;
    const gn = getGenius(champ.seat);
    const proposal = this.play.result.proposals.find((p) => p.seat === champ.seat)!;
    blit(g, bigText('THE COUNCIL DECIDES', 2, '#fff3c0', '#b8740e'), W / 2, 3);
    // Champion on a pedestal.
    rect(g, 16, 150, 64, 8, '#4a3a2a');
    rect(g, 16, 150, 64, 1, '#8a7a5a');
    rect(g, 22, 158, 52, 40, '#2a2018');
    drawFighter(g, gn.wing, Math.floor(this.t / 14) % 2 ? 'win0' : 'win1', 48, 150, 1, 'normal', Math.floor(this.t / 8));
    const bob = Math.round(Math.sin(this.t * 0.08) * 2);
    crown(g, 49, 68 + bob, 1);
    text(g, gn.name, 48, 162, { align: 'center', color: C.gold });
    text(g, WINGS[gn.wing].name.replace(/^The /, ''), 48, 170, { align: 'center', color: C.grey });
    text(g, 'CHAMPION', 48, 184, { align: 'center', color: C.white, scale: 1 });

    // Answer + EV math.
    const x = 96;
    frame(g, x, 20, W - x - 4, 44, '#1a140c', C.goldDark);
    text(g, 'THE ANSWER JAMES SHOULD ACT ON', x + 6, 24, { color: C.gold });
    const ans = wrap(proposal.answer, W - x - 16).slice(0, 3);
    ans.forEach((l, i) => text(g, l, x + 6, 33 + i * 7, { color: C.white }));
    wrap(`MOVE: ${proposal.reasoning}`, W - x - 16).slice(0, 2).forEach((l, i) => text(g, l, x + 6, 35 + ans.length * 7 + i * 7, { color: C.grey }));
    frame(g, x, 66, W - x - 4, 62, '#0e0c10');
    text(g, `SEAT CREDIBILITY C_SEAT = ${champ.credibility.toFixed(2)}`, x + 6, 70, { color: C.cyan });
    champ.outcomes.slice(0, 3).forEach((o, i) => {
      const y = 79 + i * 15;
      const c = o.credibility;
      const desc = o.description.length > 44 ? `${o.description.slice(0, 43)}.` : o.description;
      text(g, desc, x + 6, y, { color: C.white });
      text(
        g,
        o.riskSupport > 0
          ? `C_K=${c.toFixed(2)}  RISK SUPPORT=${o.riskSupport.toFixed(2)}  P'=${o.calibratedProbability.toFixed(2)}  M'=${o.calibratedMatters.toFixed(3)}`
          : o.matters < 0 && c < champ.credibility
          ? `C_K=${c.toFixed(2)}  P'=MIN(OUTCOME,SEAT)=${o.calibratedProbability.toFixed(2)}  M'=${o.calibratedMatters.toFixed(3)}`
          : `C_K=${c.toFixed(2)}  P'=${c.toFixed(2)}*${o.probability.toFixed(2)}+${(1 - c).toFixed(2)}*${SKEPTICAL_PRIOR}=${o.calibratedProbability.toFixed(2)}  M'=${o.calibratedMatters.toFixed(3)}`,
        x + 10,
        y + 7,
        { color: C.grey },
      );
    });
    text(g, `EV = SUM P'*M' = ${fmt(champ.calibratedEV, 3)}   (CLAIMED ${fmt(champ.claimedEV, 3)})`, x + 6, 120, { color: C.sound });

    // Standings.
    frame(g, x, 130, W - x - 4, 34, '#0e0c10');
    v.standings.forEach((s, i) => {
      const y = 134 + i * 9;
      text(g, `${i + 1}. ${nameOf(s.seat)}`, x + 6, y, { color: i === 0 ? C.gold : C.white });
      bar(g, x + 74, y, 34, 6, s.calibratedEV / EV_SCALE, i === 0 ? C.gold : C.sound);
      text(g, `${fmt(s.calibratedEV, 3)} / CLAIMED ${fmt(s.claimedEV, 2)}`, W - 8, y, { align: 'right', color: C.grey });
    });

    // The flag.
    if (v.fightsChangedTheAnswer) {
      const loud = v.standings.find((s) => s.seat === v.loudestClaim)!;
      const flash = this.t < 90 ? blink(this.t, 6) : true;
      frame(g, 4, 200 - 30, W - 8, 32, flash ? '#3a0c10' : '#1a0608', C.fallacy);
      text(g, 'THE FIGHTS CHANGED THE ANSWER', W / 2, 174, { align: 'center', color: C.fallacy, scale: 1 });
      text(g, `LOUDEST RAW CLAIM: ${nameOf(loud.seat)} (${fmt(loud.claimedEV)}) - BROKEN, CREDIBILITY ${loud.credibility.toFixed(2)},`, W / 2, 183, { align: 'center', color: C.white });
      text(g, `CALIBRATED EV FELL TO ${fmt(loud.calibratedEV, 3)}. THE CROWN WENT TO A DEFENDED ANSWER.`, W / 2, 191, { align: 'center', color: C.white });
    } else {
      frame(g, 4, 170, W - 8, 32, '#0c1a10', C.sound);
      text(g, 'THE LOUDEST CLAIM SURVIVED CROSS-EXAMINATION AND KEPT THE CROWN', W / 2, 182, { align: 'center', color: C.sound });
    }
    if (this.t > 40 && blink(this.t, 20)) hint(g, 'ENTER - BACK TO TITLE');
  }
}
