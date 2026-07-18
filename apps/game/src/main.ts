/**
 * VERBAL KOMBAT — demo client.
 *
 * Runs the scripted free-will match through the real pipeline
 * (agents → judge → combat mapper → replay), then plays it back:
 * the fight on canvas, the transcript roaring by in the side window,
 * and a scrubber that resolves any moment of the fight back to the
 * exact exchange that caused it.
 */

import { ROSTER, type CombatEvent, type MatchReplay, type Side, type TranscriptEntry } from '@vk/core';
import { FREE_WILL, ScriptedAgent } from '@vk/debate';
import { ScriptAwareJudge } from '@vk/judge';
import { runMatch } from '@vk/replay';

/* ------------------------------------------------------------------ */
/* Match precomputation                                                */
/* ------------------------------------------------------------------ */

const ARCH_A = ROSTER.find((r) => r.id === 'socrates_prime')!;
const ARCH_B = ROSTER.find((r) => r.id === 'silver_tongue')!;

async function computeMatch(): Promise<MatchReplay> {
  const config = {
    id: 'demo',
    topic: FREE_WILL.topic,
    stances: FREE_WILL.stances,
    fighters: { A: ARCH_A.id, B: ARCH_B.id },
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
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $('#arena') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const transcriptEl = $('#transcript');
const verdictEl = $('#verdict');
const btnFight = $('#btn-fight') as HTMLButtonElement;
const scrub = $('#scrub') as unknown as HTMLInputElement;
const scrubLabel = $('#scrub-label');

$('#topic').textContent = `“${FREE_WILL.topic}”`;
$('#hp-a .hp-name').textContent = `${ARCH_A.name.toUpperCase()} — ${FREE_WILL.stances.A.split(';')[0]}`;
$('#hp-b .hp-name').textContent = `${ARCH_B.name.toUpperCase()} — ${FREE_WILL.stances.B.split(';')[0]}`;

/* ------------------------------------------------------------------ */
/* Fighter rendering                                                   */
/* ------------------------------------------------------------------ */

type Pose = 'idle' | 'lunge' | 'recoil' | 'block' | 'stumble' | 'whiff' | 'ko' | 'victory';

interface FighterVis {
  side: Side;
  homeX: number;
  x: number;
  color: string;
  accent: string;
  pose: Pose;
  poseT: number; // ms remaining in pose
  hp: number;
}

const GROUND = 400;
const fighters: Record<Side, FighterVis> = {
  A: { side: 'A', homeX: 270, x: 270, color: ARCH_A.palette.primary, accent: ARCH_A.palette.secondary, pose: 'idle', poseT: 0, hp: 100 },
  B: { side: 'B', homeX: 690, x: 690, color: ARCH_B.palette.primary, accent: ARCH_B.palette.secondary, pose: 'idle', poseT: 0, hp: 100 },
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

function drawFighter(f: FighterVis, t: number): void {
  const facing = f.side === 'A' ? 1 : -1;
  const bob = f.pose === 'idle' ? Math.sin(t / 380 + (f.side === 'A' ? 0 : 2)) * 4 : 0;
  let dx = 0, lean = 0, crouch = 0, fallen = 0;

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

  // torso
  ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -110); ctx.stroke();
  // head
  ctx.beginPath(); ctx.arc(0, -128, 16, 0, Math.PI * 2); ctx.fill();
  // legs
  ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(-18, 0); ctx.moveTo(0, -46); ctx.lineTo(20, 0); ctx.stroke();
  // arms — attack arm extends on lunge/whiff, both raise on block
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

  // accent sash
  ctx.strokeStyle = f.accent;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-8, -100); ctx.lineTo(10, -60); ctx.stroke();

  ctx.restore();
}

function ease(remaining: number): number {
  // pose progress 0..1 → punchy in-out
  const p = 1 - Math.min(1, remaining / POSE_MS);
  return p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
}

const POSE_MS = 620;

function setPose(side: Side, pose: Pose): void {
  const f = fighters[side];
  f.pose = pose;
  f.poseT = POSE_MS;
}

/* ------------------------------------------------------------------ */
/* Arena render loop                                                   */
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

  // backdrop
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#170d10');
  g.addColorStop(1, '#050304');
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

  // torches
  for (const tx of [70, 890]) {
    ctx.fillStyle = `rgba(224, 148, 41, ${0.5 + Math.sin(t / 90 + tx) * 0.18})`;
    ctx.beginPath(); ctx.ellipse(tx, 90 + Math.sin(t / 130 + tx) * 3, 9, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(tx - 3, 108, 6, 46);
  }

  // ground
  ctx.fillStyle = '#1d1214';
  ctx.fillRect(-20, GROUND + 4, canvas.width + 40, canvas.height);
  ctx.strokeStyle = '#3a2226';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, GROUND + 5); ctx.lineTo(canvas.width, GROUND + 5); ctx.stroke();

  // dried blood on the stone
  ctx.fillStyle = 'rgba(90, 14, 14, 0.5)';
  ctx.beginPath(); ctx.ellipse(430, GROUND + 18, 60, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(600, GROUND + 26, 34, 5, 0, 0, Math.PI * 2); ctx.fill();

  drawFighter(fighters.A, t);
  drawFighter(fighters.B, t);

  // blood
  ctx.fillStyle = '#a41616';
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // event banner
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
/* Playback                                                            */
/* ------------------------------------------------------------------ */

const EXCHANGE_MS = 2400;
let replay: MatchReplay | null = null;
let playing = false;

function setHp(side: Side, hp: number): void {
  fighters[side].hp = hp;
  const el = document.querySelector(`#hp-${side.toLowerCase()} .hp-fill`) as HTMLElement;
  el.style.width = `${hp}%`;
}

function appendLine(entry: TranscriptEntry): HTMLElement {
  const div = document.createElement('div');
  div.className = `line side-${entry.argument.side}`;
  div.dataset['seq'] = String(entry.argument.seq);
  const who = entry.argument.side === 'A' ? ARCH_A.name : ARCH_B.name;
  const tags = entry.verdict.fallacies.length
    ? entry.verdict.fallacies.map((f) => `<span class="tag fallacy">${f.replace(/_/g, ' ').toUpperCase()}</span>`).join('')
    : `<span class="tag clean">SOUND ${(entry.verdict.soundness * 100).toFixed(0)}%</span>`;
  div.innerHTML = `<span class="who">${who.toUpperCase()}${tags}</span>${entry.argument.text}`;
  transcriptEl.appendChild(div);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  return div;
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
        spawnBlood(tf.homeX, GROUND - 100, ev.type === 'launcher' ? 26 : ev.type === 'heavy' ? 18 : 10);
        shake = ev.type === 'launcher' ? 260 : 140;
      }, 240);
      if (ev.label) banner = { text: ev.label, t: 1500, big: false, color: '#e3c34c' };
      break;
    case 'whiff':
      setPose(actor, 'whiff');
      banner = { text: `${ev.label} — WHIFF`, t: 1500, big: false, color: '#8b8b8b' };
      break;
    case 'labeled_block':
      setPose(actor, 'lunge');
      setTimeout(() => setPose(target, 'block'), 200);
      banner = { text: ev.label ?? 'BLOCKED', t: 1600, big: false, color: '#d84a5e' };
      break;
    case 'backfire':
      setPose(actor, 'stumble');
      spawnBlood(fighters[actor].homeX, GROUND - 90, 12);
      banner = { text: `${ev.label} — BACKFIRE`, t: 1600, big: false, color: '#d84a5e' };
      shake = 120;
      break;
    case 'finisher':
      setPose(actor, 'lunge');
      setTimeout(() => {
        setPose(target, 'ko');
        spawnBlood(tf.homeX, GROUND - 90, 60);
        shake = 500;
        banner = { text: 'FATALITY', sub: 'POSITION DISMANTLED', t: 4200, big: true, color: '#c22a2a' };
        setPose(actor, 'victory');
      }, 300);
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

function showVerdict(entry: TranscriptEntry): void {
  verdictEl.textContent = entry.verdict.rationale;
}

async function play(): Promise<void> {
  if (playing) return;
  playing = true;
  btnFight.disabled = true;
  transcriptEl.innerHTML = '';
  verdictEl.textContent = '';
  setHp('A', 100); setHp('B', 100);
  setPose('A', 'idle'); setPose('B', 'idle');
  fighters.A.pose = 'idle'; fighters.B.pose = 'idle';

  replay = await computeMatch();
  banner = { text: 'ROUND 1', sub: 'ARGUE', t: 1600, big: true, color: '#c9a227' };
  await sleep(1700);

  for (const entry of replay.entries) {
    appendLine(entry);
    showVerdict(entry);
    enactCombat(entry);
    await sleep(300);
    applyEntryDamage(entry);
    await sleep(EXCHANGE_MS - 300);
  }

  const winner = replay.winner === 'A' ? ARCH_A.name : ARCH_B.name;
  await sleep(800);
  banner = { text: `${winner.toUpperCase()} WINS`, sub: 'the annotated transcript is ready — scrub the fight', t: 5000, big: true, color: '#c9a227' };

  scrub.disabled = false;
  scrub.max = String(replay.entries.length - 1);
  scrub.value = scrub.max;
  scrubLabel.textContent = 'REPLAY — scrub exchanges';
  btnFight.textContent = 'RE-FIGHT';
  btnFight.disabled = false;
  playing = false;
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
  showVerdict(entry);
  enactCombat(entry);
  scrubLabel.textContent = `exchange ${index + 1}/${replay.entries.length} — t=${(entry.argument.t / 1000).toFixed(1)}s`;
}

btnFight.addEventListener('click', () => void play());
scrub.addEventListener('input', () => scrubTo(Number(scrub.value)));

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
