import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build a minimal browser-like global context for the IIFE modules.
function loadModule(file) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInNewContext(code, { window: globalThis, console, Math, Number, document: undefined }, { filename: file });
}

// Load modules in dependency order.
loadModule('src/core/namespace.js');
loadModule('src/core/config.js');
loadModule('src/core/rng.js');
loadModule('src/engine/ledger.js');
loadModule('src/engine/judges.js');
loadModule('src/engine/combat.js');
loadModule('src/engine/state.js');

const VK = globalThis.VK;

// --- RNG tests ---
const rngA = VK.rng.create('match-one');
const rngB = VK.rng.create('match-one');
const drawsA = [];
const drawsB = [];
for (let i = 0; i < 20; i++) {
  drawsA.push(rngA.random('combat'));
  drawsB.push(rngB.random('combat'));
}
assert.deepEqual(drawsA, drawsB, 'same seed must produce same combat stream');

const combatStream = [];
const aiStream = [];
const rngC = VK.rng.create('shared');
for (let i = 0; i < 10; i++) combatStream.push(rngC.random('combat'));
for (let i = 0; i < 10; i++) aiStream.push(rngC.random('ai'));
const rngD = VK.rng.create('shared');
const combatReplay = [];
for (let i = 0; i < 10; i++) combatReplay.push(rngD.random('combat'));
assert.deepEqual(combatStream, combatReplay, 'streams must be independent and reproducible');

// --- Ledger tests ---
const ledger = VK.ledger.create({ seed: 42, player: { id: 'player', name: 'You' }, enemy: { id: 'enemy', name: 'Sophist' } });
assert.equal(ledger.header.type, 'match-start');
assert.equal(ledger.header.seed, 42);
VK.ledger.append(ledger, { type: 'hit', attacker: 'player', timestamp: 60 });
assert.equal(ledger.events.length, 1);
assert.equal(VK.ledger.lastEvent(ledger).type, 'hit');
assert.equal(VK.ledger.formatTime(60), '00:01.00');

// --- State determinism tests ---
const moves = [
  { id: 'a', name: 'Ad Hominem', damage: 7, risk: 7 },
  { id: 'b', name: 'Slippery Slope', damage: 5, risk: 6 },
];

function runMatch(seed, inputs) {
  const s = VK.state.start(VK.state.create(moves));
  s.rng = VK.rng.create(seed);
  s.ledger = VK.ledger.create({ seed });
  inputs.forEach(({ dt, move }) => {
    VK.state.update(s, dt);
    if (move !== undefined) VK.state.playerMove(s, move);
  });
  return s;
}

const inputs = [{ dt: 0.1, move: 0 }, { dt: 0.1 }, { dt: 0.1, move: 1 }];
const matchA = runMatch('seed-a', inputs);
const matchB = runMatch('seed-a', inputs);
assert.deepEqual(matchA.ledger.events.map(e => ({ type: e.type, attacker: e.attacker, damage: e.damage })),
  matchB.ledger.events.map(e => ({ type: e.type, attacker: e.attacker, damage: e.damage })),
  'same seed and inputs must produce identical ledger events');

// --- Judge tests ---
const judgeLedger = VK.ledger.create({ seed: 1 });
VK.ledger.append(judgeLedger, { type: 'hit', attacker: 'player', defender: 'enemy', move: moves[0], damage: 7, timestamp: 10 });
VK.ledger.append(judgeLedger, { type: 'hit', attacker: 'player', defender: 'enemy', move: moves[1], damage: 5, timestamp: 20 });
VK.ledger.append(judgeLedger, { type: 'countered', attacker: 'enemy', defender: 'player', move: moves[0], damage: 10, timestamp: 30 });

const verdict = VK.judges.scoreMatch(judgeLedger);
assert.equal(verdict.judges.length, 3);
assert.ok(verdict.winner.id === 'player' || verdict.winner.id === 'enemy', 'verdict must pick a winner');

verdict.judges.forEach(j => {
  assert.ok(typeof j.player.total === 'number', 'each judge must score the player');
  assert.ok(typeof j.enemy.total === 'number', 'each judge must score the enemy');
  assert.ok(j.player.top.length <= 3, 'player top moments list has at most 3 entries');
  assert.ok(j.enemy.top.length <= 3, 'enemy top moments list has at most 3 entries');
});

const playerFavored = verdict.judges.filter(j => j.winner.id === 'player').length;
assert.ok(playerFavored >= 2, 'player should win majority of judges after two clean hits');

const closing = VK.judges.closingStatement(judgeLedger, verdict.winner);
assert.ok(typeof closing === 'string' && closing.length > 0, 'closing statement must be a non-empty string');
assert.ok(closing.includes(verdict.winner.name), 'closing statement must name the winner');

console.log('Verdict tests passed.');
