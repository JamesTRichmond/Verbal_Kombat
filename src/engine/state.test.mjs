import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..', '..', 'Verbal_Kombat');

// Minimal browser globals the IIFE modules expect.
globalThis.window = globalThis;
globalThis.VK = {};

function fileUrl(p) {
  return 'file://' + p;
}

// Load engine modules in dependency order.
await import(fileUrl(join(root, 'src', 'core', 'config.js')));
await import(fileUrl(join(root, 'src', 'engine', 'combat.js')));
await import(fileUrl(join(root, 'src', 'engine', 'state.js')));

const VK = global.window.VK;

const studio = {
  id: 'studio',
  name: 'The Studio',
  palette: { skyTop: '#0f1a25', skyBottom: '#1c2f3f', floor: '#141f2b', accent: '#4aa3e4' },
  event: { id: 'studio_spotlight', name: 'Spotlight', interval: 10, effect: { type: 'composureRestore', amount: 15, duration: 1 } },
};

const forum = {
  id: 'forum',
  name: 'The Forum',
  palette: { skyTop: '#2b1f3a', skyBottom: '#4a3b5c', floor: '#3d324a', accent: '#e4b04a' },
  event: { id: 'forum_echo', name: 'Echo', interval: 8, effect: { type: 'dialogueWeightBoost', multiplier: 2, duration: 1 } },
};

const moves = [
  { id: 'straw_man', name: 'Straw Man', damage: 6, risk: 5, example: 'So...' },
  { id: 'false_dilemma', name: 'False Dilemma', damage: 6, risk: 5, example: 'Either...' },
];

// 1. Arena is recorded in ledger header.
const state = VK.state.create(moves, studio);
assert.equal(state.location.id, 'studio', 'arena stored in state');
assert.equal(state.ledger[0].type, 'matchStart', 'ledger opens with matchStart');
assert.equal(state.ledger[0].location.id, 'studio', 'ledger records arena id');
assert.equal(state.ledger[0].location.name, 'The Studio', 'ledger records arena name');

// 2. Start preserves arena.
const started = VK.state.start(state);
assert.equal(started.location.id, 'studio', 'start preserves arena');
assert.equal(started.phase, 'fighting', 'start enters fighting phase');

// 3. Arena event becomes pending after its interval.
const fighting = VK.state.start(state);
fighting.arenaEvent.timer = 0.1;
VK.state.update(fighting, 1);
assert.equal(fighting.arenaEvent.pending, true, 'arena event becomes pending');
const readyRecord = fighting.ledger.find(r => r.type === 'arenaEventReady');
assert.ok(readyRecord, 'arenaEventReady emitted to ledger');
assert.equal(readyRecord.eventId, 'studio_spotlight', 'ready record references event id');

// 4. Studio spotlight restores composure on next hit.
fighting.fighters.player.composure = 10;
const before = fighting.fighters.player.composure;
VK.state.playerMove(fighting, 0); // hit
const triggered = fighting.ledger.find(r => r.type === 'arenaEventTriggered');
assert.ok(triggered, 'arenaEventTriggered emitted');
assert.equal(triggered.effect, 'composureRestore', 'effect recorded');
assert.ok(fighting.fighters.player.composure > before, 'composure restored on hit');
assert.equal(fighting.arenaEvent.pending, false, 'event consumed and reset');

// 5. Forum echo doubles dialogue weight on next hit.
const forumState = VK.state.start(VK.state.create(moves, forum));
forumState.arenaEvent.pending = true;
forumState.fighters.player.composure = 100;
VK.state.playerMove(forumState, 0);
const hitRecord = forumState.ledger.find(r => r.type === 'hit');
assert.equal(hitRecord.dialogueWeight, 2, 'Forum echo doubles dialogue weight');

// 6. Non-hit events do not consume pending arena event.
const forumState2 = VK.state.start(VK.state.create(moves, forum));
forumState2.arenaEvent.pending = true;
// Force a fizzle by draining composure.
forumState2.fighters.player.composure = 0;
VK.state.playerMove(forumState2, 0);
assert.equal(forumState2.arenaEvent.pending, true, 'pending event survives fizzle');

console.log('State / ledger / arena event tests passed.');
