/**
 * VERBAL KOMBAT — demo client with the full match ritual.
 *
 * Flow (the MK ceremony, re-derived for debate — docs/UI-REFERENCE.md):
 *   CHOOSE FIGHTERS → VS (stances as tale-of-the-tape) → ARENA CARD
 *   → ROUND 1 → ARGUE! → the fight → FINISH THE ARGUMENT → FATALITY
 *   → REPORT CARD → STUDY THE TRANSCRIPT (replay scrubber)
 */

import {
  ROSTER,
  xpForMatch,
  type CombatEvent,
  type FighterArchetype,
  type MatchReplay,
  type Side,
  type TranscriptEntry,
} from '@vk/core';
import { FREE_WILL, ScriptedAgent } from '@vk/debate';
import { ScriptAwareJudge } from '@vk/judge';
import { runMatch } from '@vk/replay';

/* ------------------------------------------------------------------ */
/* Match computation                                                   */
/* ------------------------------------------------------------------ */

const ARENA_NAME = 'THE COURTROOM OF CAUSATION';

async function computeMatch(fighters: Record<Side, string>): Promise<MatchReplay> {
  const config = {
    id: 'demo',
    topic: FREE_WILL.topic,
    stances: FREE_WILL.stances,
    fighters,
    mode: 'exhibition' as const,
  };
  const isCloser = (a: { text: string }) =>
    FREE_WILL.lines.find((l) => l.text === a.text)?.annotations?.isCloser === true;
  const { replay } = await runMatch(
    config,
    { A: new ScriptedAgent(FREE_WILL, 'A'), B: new ScriptedAgent(FREE_WILL, 'B') },
    new ScriptAwareJudge(FREE_WILL),
    { isCloser },
  );
  return replay;
}

/* ------------------------------------------------------------------ */
/* DOM handles                                                         */
/* ------------------------------------------------------------------ */

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $('#arena') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const transcriptEl = $('#transcript');
const verdictEl = $('#verdict');
const btnFight = $('#btn-fight') as HTMLButtonElement;
const scrub = $('#scrub') as unknown as HTMLInputElement;
const scrubLabel = $('#scrub-label');
const overlay = $('#overlay');
const comboEls: Record<Side, HTMLElement> = { A: $('#combo-a'), B: $('#combo-b') };

$('#topic').textContent = `“${FREE_WILL.topic}”`;

/* ------------------------------------------------------------------ */
/* Selection state                                                     */
/* ------------------------------------------------------------------ */

const chosen: { A: FighterArchetype; B: FighterArchetype } = {
  A: ROSTER[0]!,
  B: ROSTER[2]!,
};

function applySelectionToHud(): void {
  $('#hp-a .hp-name').textContent = `${chosen.A.name.toUpperCase()} — ${FREE_WILL.stances.A.split(';')[0]}`;
  $('#hp-b .hp-name').textContent = `${chosen.B.name.toUpperCase()} — ${FREE_WILL.stances.B.split(';')[0]}`;
  fighters.A.color = chosen.A.palette.primary;
  fighters.A.accent = chosen.A.palette.secondary;
  fighters.B.color = chosen.B.palette.primary;
  fighters.B.accent = chosen.B.palette.secondary;
}

/* ------------------------------------------------------------------ */
/* Fighter rendering (canvas)                                          */
/* ------------------------------------------------------------------ */

type Pose = 'idle' | 'lunge' | 'recoil' | 'block' | 'stumble' | 'whiff' | 'ko' | 'victory';

interface FighterVis {
  side: Side;
  homeX: number;
  x: number;
  color: string;
  accent: string;
  pose: Pose;
  poseT: number;
  hp: number;
  /** Post-backfire vulnerability wobble (UI-REFERENCE §1: STAGGERED). */
  staggered: boolean;
}

const GROUND = 400;
const fighters: Record<Side, FighterVis> = {
  A: { side: 'A', homeX: 270, x: 270, color: '#c9a227', accent: '#3d3424', pose: 'idle', poseT: 0, hp: 100, staggered: false },
  B: { side: 'B', homeX: 690, x: 690, color: '#a4243b', accent: '#2b0d13', pose: 'idle', poseT: 0, hp: 100, staggered: false },
};

interface Particle { x: number; y: number; vx: number; vy: number; life: number; }
let particles: Particle[] = [];

interface Banner { text: string; sub?: string; t: number; big: boolean; color: string; }
let banner: Banner | null = null;

let shake = 0;

function spawnBlood(x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 340,
      vy: -Math.random() * 260 - 40,
      life: 600 + Math.random() * 500,
    });
  }
}

const POSE_MS = 620;

function ease(remaining: number): number {
  const p = 1 - Math.min(1, remaining / POSE_MS);
  return p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
}

function setPose(side: Side, pose: Pose): void {
  const f = fighters[side];
  f.pose = pose;
  f.poseT = POSE_MS;
}

function drawFighter(f: FighterVis, t: number): void {
  const facing = f.side === 'A' ? 1 : -1;
  const staggerSway = f.staggered && f.pose === 'idle' ? Math.sin(t / 110) * 6 : 0;
  const bob = f.pose === 'idle' ? Math.sin(t / 380 + (f.side === 'A' ? 0 : 2)) * 4 : 0;
  let dx = staggerSway, lean = staggerSway * 0.02, crouch = f.staggered && f.pose === 'idle' ? 6 : 0, fallen = 0;

  switch (f.pose) {
    case 'lunge': dx = facing * 120 * ease(f.poseT); lean = facing * 0.5 * ease(f.poseT); break;
    case 'whiff': dx = facing * 150 * ease(f.poseT); lean = facing * 0.9 * ease(f.poseT); break;
    case 'recoil': dx = -facing * 46 * ease(f.poseT); lean = -facing * 0.4 * ease(f.poseT); break;
    case 'block': crouch = 14 * ease(f.poseT); break;
    case 'stumble': dx = -facing * 30 * ease(f.poseT); lean = -facing * 0.7 * ease(f.poseT); crouch = 10; break;
    case 'ko': fallen = 1; break;
    case 'victory': crouch = -8 * Math.abs(Math.sin(t / 250)); break;
  }

  const x = f.x + dx;
  const y = GROUND + bob + crouch;

  ctx.save();
  ctx.translate(x, y);
  if (fallen) {
    ctx.rotate(facing * Math.PI / 2);
    ctx.translate(0, 40);
  } else {
    ctx.rotate(lean * 0.35);
  }

  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.strokeStyle = f.color;
  ctx.fillStyle = f.color;

  ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -110); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -128, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(-18, 0); ctx.moveTo(0, -46); ctx.lineTo(20, 0); ctx.stroke();

  ctx.beginPath();
  if (f.pose === 'lunge' || f.pose === 'whiff') {
    ctx.moveTo(0, -96); ctx.lineTo(facing * 58, -104);
    ctx.moveTo(0, -92); ctx.lineTo(-facing * 26, -70);
  } else if (f.pose === 'block') {
    ctx.moveTo(0, -96); ctx.lineTo(facing * 26, -118);
    ctx.moveTo(0, -92); ctx.lineTo(facing * 30, -96);
  } else {
    ctx.moveTo(0, -96); ctx.lineTo(facing * 30, -74);
    ctx.moveTo(0, -92); ctx.lineTo(-facing * 24, -70);
  }
  ctx.stroke();

  ctx.strokeStyle = f.accent;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-8, -100); ctx.lineTo(10, -60); ctx.stroke();

  // stagger stars
  if (f.staggered && !fallen) {
    ctx.fillStyle = '#e3c34c';
    for (let i = 0; i < 3; i++) {
      const a = t / 300 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 24, -150 + Math.sin(a) * 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Render loop                                                         */
/* ------------------------------------------------------------------ */

let lastFrame = performance.now();

function frame(now: number): void {
  const dt = Math.min(50, now - lastFrame);
  lastFrame = now;

  for (const f of Object.values(fighters)) {
    if (f.poseT > 0) {
      f.poseT -= dt;
      if (f.poseT <= 0 && f.pose !== 'ko' && f.pose !== 'victory') f.pose = 'idle';
    }
  }
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.vy += 900 * (dt / 1000);
    p.x += p.vx * (dt / 1000);
    p.y += p.vy * (dt / 1000);
    if (p.y > GROUND + 6) { p.y = GROUND + 6; p.vy = 0; p.vx *= 0.7; }
  }
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (shake > 0) shake = Math.max(0, shake - dt);

  draw(now);
  requestAnimationFrame(frame);
}

function draw(t: number): void {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8);

  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#170d10');
  g.addColorStop(1, '#050304');
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

  for (const tx of [70, 890]) {
    ctx.fillStyle = `rgba(224, 148, 41, ${0.5 + Math.sin(t / 90 + tx) * 0.18})`;
    ctx.beginPath(); ctx.ellipse(tx, 90 + Math.sin(t / 130 + tx) * 3, 9, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(tx - 3, 108, 6, 46);
  }

  ctx.fillStyle = '#1d1214';
  ctx.fillRect(-20, GROUND + 4, canvas.width + 40, canvas.height);
  ctx.strokeStyle = '#3a2226';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, GROUND + 5); ctx.lineTo(canvas.width, GROUND + 5); ctx.stroke();

  ctx.fillStyle = 'rgba(90, 14, 14, 0.5)';
  ctx.beginPath(); ctx.ellipse(430, GROUND + 18, 60, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(600, GROUND + 26, 34, 5, 0, 0, Math.PI * 2); ctx.fill();

  drawFighter(fighters.A, t);
  drawFighter(fighters.B, t);

  ctx.fillStyle = '#a41616';
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  if (banner) {
    const alpha = Math.min(1, banner.t / 300);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = banner.color;
    ctx.font = banner.big ? 'bold 54px Impact, sans-serif' : 'bold 30px Impact, sans-serif';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 14;
    ctx.fillText(banner.text, canvas.width / 2, banner.big ? 200 : 160);
    if (banner.sub) {
      ctx.font = 'italic 16px Georgia, serif';
      ctx.fillStyle = '#d8cfc0';
      ctx.fillText(banner.sub, canvas.width / 2, banner.big ? 236 : 190);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

requestAnimationFrame(frame);

/* ------------------------------------------------------------------ */
/* Combo popups                                                        */
/* ------------------------------------------------------------------ */

function showCombo(side: Side, label: string): void {
  const el = comboEls[side];
  el.textContent = label;
  el.classList.remove('shatter');
  el.classList.add('show');
}

function shatterCombo(side: Side): void {
  const el = comboEls[side];
  if (!el.classList.contains('show')) return;
  el.classList.remove('show');
  el.classList.add('shatter');
}

function clearCombo(side: Side): void {
  const el = comboEls[side];
  el.classList.remove('show', 'shatter');
  el.textContent = '';
}

/* ------------------------------------------------------------------ */
/* Overlay screens                                                     */
/* ------------------------------------------------------------------ */

function showOverlay(html: string): void {
  overlay.innerHTML = html;
  overlay.classList.add('active');
}

function hideOverlay(): void {
  overlay.classList.remove('active');
  overlay.innerHTML = '';
}

const TRAITS: { key: keyof FighterArchetype['traits']; label: string }[] = [
  { key: 'interrogation', label: 'Interrogation' },
  { key: 'empiricism', label: 'Empiricism' },
  { key: 'formalism', label: 'Formalism' },
  { key: 'rhetoric', label: 'Rhetoric' },
  { key: 'aggression', label: 'Aggression' },
  { key: 'patience', label: 'Patience' },
];

function cardHtml(arch: FighterArchetype): string {
  const initials = arch.name.split(' ').map((w) => w[0] ?? '').join('');
  const traits = TRAITS.map(
    (t) => `
      <div class="trait">
        <span class="t-label">${t.label}</span>
        <span class="t-bar"><span class="t-fill" style="width:${Math.round(arch.traits[t.key] * 100)}%"></span></span>
      </div>`,
  ).join('');
  const risks = Object.keys(arch.fallacyRisk)
    .map((f) => `⚠ ${f.replace(/_/g, ' ')}`)
    .join('  ');
  return `
    <div class="fighter-card" data-id="${arch.id}">
      <div class="portrait" style="background:${arch.palette.primary}">${initials}</div>
      <div class="f-name">${arch.name.toUpperCase()}</div>
      <div class="f-title">${arch.title.toUpperCase()}</div>
      ${traits}
      <div class="risks">${risks}</div>
    </div>`;
}

function screenSelect(): void {
  let picking: Side = 'A';
  showOverlay(`
    <div class="screen">
      <h2 id="select-title">CHOOSE FIGHTER — SIDE A</h2>
      <div class="sub" id="select-sub">${FREE_WILL.stances.A}</div>
      <div class="roster-grid">${ROSTER.map(cardHtml).join('')}</div>
    </div>`);

  overlay.querySelectorAll<HTMLElement>('.fighter-card').forEach((card) => {
    card.addEventListener('click', () => {
      const arch = ROSTER.find((r) => r.id === card.dataset['id']);
      if (!arch) return;
      if (picking === 'A') {
        chosen.A = arch;
        card.classList.add('picked-a');
        picking = 'B';
        $('#select-title').textContent = 'CHOOSE FIGHTER — SIDE B';
        $('#select-sub').textContent = FREE_WILL.stances.B;
      } else {
        chosen.B = arch;
        card.classList.add('picked-b');
        applySelectionToHud();
        setTimeout(screenVs, 450);
      }
    });
  });
}

function vsSideHtml(arch: FighterArchetype, stance: string): string {
  const initials = arch.name.split(' ').map((w) => w[0] ?? '').join('');
  return `
    <div class="vs-side">
      <div class="portrait" style="background:${arch.palette.primary}">${initials}</div>
      <div class="v-name">${arch.name.toUpperCase()}</div>
      <div class="v-title">${arch.title.toUpperCase()}</div>
      <div class="v-stance">“${stance}”</div>
    </div>`;
}

function screenVs(): void {
  showOverlay(`
    <div class="screen">
      <h2>${FREE_WILL.topic.toUpperCase()}</h2>
      <div class="sub">the arena is the question</div>
      <div class="vs-row">
        ${vsSideHtml(chosen.A, FREE_WILL.stances.A)}
        <div class="vs-mark">VS</div>
        ${vsSideHtml(chosen.B, FREE_WILL.stances.B)}
      </div>
    </div>`);
  setTimeout(screenArenaCard, 3200);
}

function screenArenaCard(): void {
  showOverlay(`
    <div class="screen arena-card">
      <h2>${ARENA_NAME}</h2>
      <div class="sub">let the record show</div>
    </div>`);
  setTimeout(() => {
    hideOverlay();
    void playFight();
  }, 2000);
}

/* ------------------------------------------------------------------ */
/* Fight playback                                                      */
/* ------------------------------------------------------------------ */

const EXCHANGE_MS = 2400;
let replay: MatchReplay | null = null;
let playing = false;

function setHp(side: Side, hp: number): void {
  fighters[side].hp = hp;
  const el = document.querySelector(`#hp-${side.toLowerCase()} .hp-fill`) as HTMLElement;
  el.style.width = `${hp}%`;
}

function nameOf(side: Side): string {
  return side === 'A' ? chosen.A.name : chosen.B.name;
}

function appendLine(entry: TranscriptEntry): void {
  const div = document.createElement('div');
  div.className = `line side-${entry.argument.side}`;
  div.dataset['seq'] = String(entry.argument.seq);
  const tags = entry.verdict.fallacies.length
    ? entry.verdict.fallacies.map((f) => `<span class="tag fallacy">${f.replace(/_/g, ' ').toUpperCase()}</span>`).join('')
    : `<span class="tag clean">SOUND ${(entry.verdict.soundness * 100).toFixed(0)}%</span>`;
  div.innerHTML = `<span class="who">${nameOf(entry.argument.side).toUpperCase()}${tags}</span>${entry.argument.text}`;
  transcriptEl.appendChild(div);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function enactCombat(entry: TranscriptEntry): void {
  const ev: CombatEvent | undefined = entry.combat[0];
  if (!ev) return;
  const actor = ev.actor;
  const target: Side = actor === 'A' ? 'B' : 'A';
  const tf = fighters[target];

  switch (ev.type) {
    case 'jab':
    case 'heavy':
    case 'combo_hit':
    case 'launcher':
      setPose(actor, 'lunge');
      setTimeout(() => {
        setPose(target, 'recoil');
        tf.staggered = false; // punished or simply hit — the window closes
        spawnBlood(tf.homeX, GROUND - 100, ev.type === 'launcher' ? 26 : ev.type === 'heavy' ? 18 : 10);
        shake = ev.type === 'launcher' ? 260 : 140;
      }, 240);
      if (ev.combo > 1) showCombo(actor, ev.type === 'launcher' ? `DEVASTATING REBUTTAL` : (ev.label ?? ''));
      if (ev.label && ev.combo <= 1) banner = { text: ev.label, t: 1500, big: false, color: '#e3c34c' };
      break;
    case 'whiff':
      setPose(actor, 'whiff');
      shatterCombo(actor);
      banner = { text: `${ev.label} — WHIFF`, t: 1500, big: false, color: '#8b8b8b' };
      break;
    case 'labeled_block':
      setPose(actor, 'lunge');
      shatterCombo(actor);
      setTimeout(() => setPose(target, 'block'), 200);
      banner = { text: ev.label ?? 'BLOCKED', t: 1600, big: false, color: '#d84a5e' };
      break;
    case 'backfire':
      setPose(actor, 'stumble');
      shatterCombo(actor);
      fighters[actor].staggered = true;
      spawnBlood(fighters[actor].homeX, GROUND - 90, 12);
      banner = { text: `${ev.label} — BACKFIRE`, t: 1600, big: false, color: '#d84a5e' };
      shake = 120;
      break;
    case 'finisher':
      banner = { text: 'FINISH THE ARGUMENT', t: 1400, big: true, color: '#c22a2a' };
      setPose(actor, 'lunge');
      setTimeout(() => {
        setPose(target, 'ko');
        spawnBlood(tf.homeX, GROUND - 90, 60);
        shake = 500;
        banner = { text: 'FATALITY', sub: 'POSITION DISMANTLED', t: 4200, big: true, color: '#c22a2a' };
        setPose(actor, 'victory');
      }, 900);
      break;
  }
}

function applyEntryDamage(entry: TranscriptEntry): void {
  for (const ev of entry.combat) {
    const target: Side = ev.actor === 'A' ? 'B' : 'A';
    if (ev.damage > 0) setHp(target, Math.max(0, fighters[target].hp - ev.damage));
    if (ev.selfDamage > 0) setHp(ev.actor, Math.max(0, fighters[ev.actor].hp - ev.selfDamage));
  }
}

async function playFight(): Promise<void> {
  if (playing) return;
  playing = true;
  btnFight.disabled = true;
  transcriptEl.innerHTML = '';
  verdictEl.textContent = '';
  setHp('A', 100); setHp('B', 100);
  fighters.A.pose = 'idle'; fighters.B.pose = 'idle';
  fighters.A.staggered = false; fighters.B.staggered = false;
  clearCombo('A'); clearCombo('B');
  document.querySelectorAll('.pips i').forEach((el) => el.classList.remove('won'));

  replay = await computeMatch({ A: chosen.A.id, B: chosen.B.id });

  banner = { text: 'ROUND 1', sub: 'ARGUE!', t: 1600, big: true, color: '#c9a227' };
  await sleep(1700);

  for (const entry of replay.entries) {
    appendLine(entry);
    verdictEl.textContent = entry.verdict.rationale;
    enactCombat(entry);
    await sleep(300);
    applyEntryDamage(entry);
    await sleep(EXCHANGE_MS - 300);
  }

  await sleep(1200);
  if (replay.winner) {
    const pip = document.querySelector(`#hp-${replay.winner.toLowerCase()} .pips i`);
    pip?.classList.add('won');
  }
  screenReport();
  playing = false;
}

/* ------------------------------------------------------------------ */
/* Report card                                                         */
/* ------------------------------------------------------------------ */

function fallacyNames(side: Side): string {
  if (!replay) return '—';
  const names = replay.entries
    .filter((e) => e.argument.side === side)
    .flatMap((e) => e.verdict.fallacies)
    .map((f) => f.replace(/_/g, ' '));
  return names.length ? names.join(', ') : 'none';
}

function screenReport(): void {
  if (!replay) return;
  const w = replay.winner;
  const winnerName = w ? nameOf(w).toUpperCase() : 'DRAW';
  const flawless = w && replay.stats[w].fallacies === 0;
  const xpA = xpForMatch(replay, 'A');
  const xpB = xpForMatch(replay, 'B');

  const row = (label: string, a: string | number, b: string | number) => `
    <tr><th>${label}</th><td class="num col-a">${a}</td><td class="num col-b">${b}</td></tr>`;

  showOverlay(`
    <div class="screen">
      <div class="report">
        <h2>${winnerName} WINS</h2>
        <div class="verdict-line">${flawless ? 'FLAWLESS VICTORY — ZERO FALLACIES' : w ? 'POSITION DISMANTLED' : 'SPLIT DECISION'}</div>
        <table>
          <tr><th></th><th class="col-a">${chosen.A.name.toUpperCase()}</th><th class="col-b">${chosen.B.name.toUpperCase()}</th></tr>
          ${row('Arguments made', replay.stats.A.arguments, replay.stats.B.arguments)}
          ${row('Clean hits', replay.stats.A.cleanHits, replay.stats.B.cleanHits)}
          ${row('Avg soundness', `${Math.round(replay.stats.A.avgSoundness * 100)}%`, `${Math.round(replay.stats.B.avgSoundness * 100)}%`)}
          ${row('Damage dealt', replay.stats.A.totalDamageDealt, replay.stats.B.totalDamageDealt)}
          ${row('Position integrity left', replay.finalIntegrity.A, replay.finalIntegrity.B)}
          ${row('Fallacies committed', replay.stats.A.fallacies, replay.stats.B.fallacies)}
        </table>
        <div class="fallacy-list"><span class="col-a">${chosen.A.name}:</span> ${fallacyNames('A')} &nbsp;&nbsp; <span class="col-b">${chosen.B.name}:</span> ${fallacyNames('B')}</div>
        <div class="xp-line" style="margin-top:10px">XP — ${chosen.A.name}: +${xpA.total} &nbsp;&nbsp; ${chosen.B.name}: +${xpB.total}</div>
        <div class="btn-row">
          <button class="vk gold" id="btn-study">STUDY THE TRANSCRIPT</button>
          <button class="vk" id="btn-refight">NEW MATCH</button>
        </div>
      </div>
    </div>`);

  $('#btn-study').addEventListener('click', () => {
    hideOverlay();
    enableScrubber();
  });
  $('#btn-refight').addEventListener('click', () => {
    resetForNewMatch();
    screenSelect();
  });
}

function enableScrubber(): void {
  if (!replay) return;
  scrub.disabled = false;
  scrub.max = String(replay.entries.length - 1);
  scrub.value = scrub.max;
  scrubLabel.textContent = 'REPLAY — scrub exchanges';
  btnFight.textContent = 'NEW MATCH';
  btnFight.disabled = false;
}

function resetForNewMatch(): void {
  scrub.disabled = true;
  scrub.value = '0';
  scrubLabel.textContent = '';
  transcriptEl.innerHTML = '';
  verdictEl.textContent = '';
  clearCombo('A'); clearCombo('B');
  setHp('A', 100); setHp('B', 100);
  fighters.A.pose = 'idle'; fighters.B.pose = 'idle';
  fighters.A.staggered = false; fighters.B.staggered = false;
  btnFight.textContent = 'FIGHT';
  btnFight.disabled = true;
}

function scrubTo(index: number): void {
  if (!replay) return;
  const entry = replay.entries[index];
  if (!entry) return;
  document.querySelectorAll('.line').forEach((el) => el.classList.remove('selected'));
  const line = document.querySelector(`.line[data-seq="${entry.argument.seq}"]`);
  if (line) {
    line.classList.add('selected');
    line.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  verdictEl.textContent = entry.verdict.rationale;
  enactCombat(entry);
  scrubLabel.textContent = `exchange ${index + 1}/${replay.entries.length} — t=${(entry.argument.t / 1000).toFixed(1)}s`;
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

btnFight.addEventListener('click', () => {
  resetForNewMatch();
  screenSelect();
});
scrub.addEventListener('input', () => scrubTo(Number(scrub.value)));

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// The ritual begins at the select screen.
applySelectionToHud();
btnFight.disabled = true;
screenSelect();
