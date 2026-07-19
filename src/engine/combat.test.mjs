import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Provide a minimal browser-ish global for the IIFE engine scripts.
global.window = global;

function loadScript(name) {
  const file = join(__dirname, name);
  const code = readFileSync(file, 'utf8');
  vm.runInThisContext(code, { filename: file });
}

loadScript('../../src/core/namespace.js');
loadScript('../../src/core/config.js');
loadScript('../../src/engine/combat.js');
loadScript('../../src/engine/state.js');

const VK = global.window.VK;
const cfg = VK.config.combat;

function makeFighter(id, name) {
  return {
    id: id,
    name: name,
    side: id === 'player' ? 'left' : 'right',
    health: VK.config.fighter.maxHealth,
    composure: VK.config.fighter.maxComposure,
    meter: 0,
    chain: 0,
  };
}

const move = { id: 'jab', name: 'Jab', example: 'Point.', damage: 5, risk: 3 };

// Helper: land a clean hit from attacker to defender.
function hit(attacker, defender) {
  return VK.combat.resolveMove(attacker, defender, move);
}

// 1. A clean single hit logs a distinct hit event and builds meter/chain.
{
  const p = makeFighter('player', 'You');
  const e = makeFighter('enemy', 'The Sophist');
  const event = hit(p, e);
  assert.equal(event.type, 'hit');
  assert.equal(event.damage, move.damage);
  assert.equal(p.chain, 1);
  assert.ok(p.meter > 0);
  assert.equal(event.meterBefore, 0);
  assert.equal(event.meterAfter, p.meter);
  assert.equal(event.chain, 1);
}

// 2. Three consecutive landed hits form a combo on the third hit.
{
  const p = makeFighter('player', 'You');
  const e = makeFighter('enemy', 'The Sophist');
  const e1 = hit(p, e);
  const e2 = hit(p, e);
  const e3 = hit(p, e);
  assert.equal(e1.type, 'hit');
  assert.equal(e2.type, 'hit');
  assert.equal(e3.type, 'combo');
  assert.equal(e3.chain, cfg.chainLength);
  assert.equal(e3.damage, move.damage + cfg.comboBonusDamage);
  assert.equal(p.chain, 0, 'combo resets attacker chain');
}

// 3. A hit when meter is full spends it and logs a special event.
{
  const p = makeFighter('player', 'You');
  const e = makeFighter('enemy', 'The Sophist');
  p.meter = VK.config.fighter.maxMeter;
  const event = hit(p, e);
  assert.equal(event.type, 'special');
  assert.equal(event.damage, Math.round(move.damage * cfg.specialDamageMultiplier));
  assert.equal(p.meter, 0);
  assert.equal(event.meterBefore, VK.config.fighter.maxMeter);
  assert.equal(event.meterAfter, 0);
  assert.equal(p.chain, 0);
}

// 4. A fizzle or counter resets the attacker's chain.
{
  const p = makeFighter('player', 'You');
  const e = makeFighter('enemy', 'The Sophist');
  p.chain = 2;
  p.composure = 0;
  const fizzle = VK.combat.resolveMove(p, e, move);
  assert.equal(fizzle.type, 'fizzle');
  assert.equal(p.chain, 0);
}

// 5. A countered move resets the attacker's chain.
{
  const p = makeFighter('player', 'You');
  const e = makeFighter('enemy', 'The Sophist');
  p.chain = 2;
  e.composure = VK.config.fighter.maxComposure;
  const risky = { id: 'risky', name: 'Risky', example: 'Overreach!', damage: 5, risk: 10 };
  const countered = VK.combat.resolveMove(p, e, risky);
  assert.equal(countered.type, 'countered');
  assert.equal(p.chain, 0);
}

// 6. Getting hit by the opponent breaks your chain.
{
  const p = makeFighter('player', 'You');
  const e = makeFighter('enemy', 'The Sophist');
  hit(p, e); // p chain = 1
  hit(e, p); // p gets hit
  assert.equal(p.chain, 0);
}

// 7. State integration: playerMove pushes combo and special events into the ledger.
{
  const state = VK.state.create([move]);
  state.phase = 'fighting';
  // Land two hits to build chain.
  VK.state.playerMove(state, 0);
  VK.state.playerMove(state, 0);
  const lastBefore = state.log[state.log.length - 1];
  assert.equal(lastBefore.type, 'hit');
  // Third hit becomes a combo.
  VK.state.playerMove(state, 0);
  const lastAfter = state.log[state.log.length - 1];
  assert.equal(lastAfter.type, 'combo');
}

console.log('Combat engine tests passed.');
