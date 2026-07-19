import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flowSource = readFileSync(join(__dirname, 'flow.js'), 'utf-8');

// Stub a minimal browser environment so the IIFE can attach VK.flow.
global.window = { VK: {} };

eval(flowSource);

const { flow } = global.window.VK;

// Full forward traversal.
const f1 = flow.create();
assert.equal(f1.screen, flow.SCREENS.ARGUMENT);
assert.equal(f1.history.length, 0);

const f2 = flow.selectTopic(f1, 'ethics', 'Is it ever right to lie?');
assert.equal(f2.screen, flow.SCREENS.FIGHTER);
assert.deepStrictEqual(f2.topic, { categoryId: 'ethics', questionText: 'Is it ever right to lie?' });
assert.deepStrictEqual(f2.history, [flow.SCREENS.ARGUMENT]);
assert.ok(flow.canGoBack(f2));

const f3 = flow.selectFighter(f2, 'logician');
assert.equal(f3.screen, flow.SCREENS.LOCATION);
assert.equal(f3.playerFighterId, 'logician');
assert.deepStrictEqual(f3.history, [flow.SCREENS.ARGUMENT, flow.SCREENS.FIGHTER]);

const f4 = flow.selectLocation(f3, 'forum');
assert.equal(f4.screen, flow.SCREENS.FIGHT);
assert.equal(f4.locationId, 'forum');

const f5 = flow.endFight(f4, { winner: 'player', summary: 'clean ko' });
assert.equal(f5.screen, flow.SCREENS.VERDICT);
assert.deepStrictEqual(f5.fightResult, { winner: 'player', summary: 'clean ko' });

// Deep state survives to verdict.
assert.deepStrictEqual(f5.topic, { categoryId: 'ethics', questionText: 'Is it ever right to lie?' });
assert.equal(f5.playerFighterId, 'logician');
assert.equal(f5.locationId, 'forum');

// Back navigation preserves upstream selections.
const b1 = flow.goBack(f5);
assert.equal(b1.screen, flow.SCREENS.FIGHT);
assert.deepStrictEqual(b1.fightResult, f5.fightResult, 'going back preserves fight result');

const b2 = flow.goBack(b1);
assert.equal(b2.screen, flow.SCREENS.LOCATION);
assert.equal(b2.locationId, 'forum');

const b3 = flow.goBack(b2);
assert.equal(b3.screen, flow.SCREENS.FIGHTER);
assert.equal(b3.playerFighterId, 'logician');

const b4 = flow.goBack(b3);
assert.equal(b4.screen, flow.SCREENS.ARGUMENT);
assert.deepStrictEqual(b4.topic, f5.topic);
assert.equal(flow.canGoBack(b4), false);
assert.deepStrictEqual(b4, flow.goBack(b4), 'back at start is a no-op');

// Guards: transitions only work from the matching screen.
assert.equal(flow.selectFighter(f1, 'logician').screen, flow.SCREENS.ARGUMENT);
assert.equal(flow.selectLocation(f2, 'forum').screen, flow.SCREENS.FIGHTER);
assert.equal(flow.endFight(f3, {}).screen, flow.SCREENS.LOCATION);

// Reset preserves selections but returns to argument screen.
const reset = flow.reset(f5);
assert.equal(reset.screen, flow.SCREENS.ARGUMENT);
assert.equal(reset.history.length, 0);
assert.deepStrictEqual(reset.topic, f5.topic);
assert.equal(reset.playerFighterId, f5.playerFighterId);
assert.equal(reset.locationId, f5.locationId);
assert.equal(reset.fightResult, null);

console.log('Flow tests passed.');
