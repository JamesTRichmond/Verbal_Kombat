import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
}

// topics.json shape
const topics = loadJson('data/topics.json');
assert.equal(topics.categories.length, 8, 'expected 8 categories');
topics.categories.forEach(c => {
  assert.ok(c.id && typeof c.id === 'string', 'category id must be string');
  assert.ok(c.name && typeof c.name === 'string', 'category name must be string');
  assert.equal(c.questions.length, 3, 'expected 3 questions per category');
  c.questions.forEach(q => assert.equal(typeof q, 'string', 'question must be string'));
});

// fighters.json shape
const fighters = loadJson('data/fighters.json');
assert.equal(fighters.fighters.length, 4, 'expected 4 fighters');
fighters.fighters.forEach(f => {
  assert.ok(f.id && typeof f.id === 'string', 'fighter id must be string');
  assert.ok(f.name && typeof f.name === 'string', 'fighter name must be string');
  assert.ok(f.style && typeof f.style === 'string', 'fighter style must be string');
  assert.ok(f.special && f.special.name && f.special.description, 'fighter special required');
  assert.ok(f.stats, 'fighter stats required');
  ['reach', 'speed', 'power', 'defense'].forEach(stat => {
    assert.ok(Number.isInteger(f.stats[stat]) && f.stats[stat] >= 1 && f.stats[stat] <= 10,
      `stat ${stat} must be integer 1-10`);
  });
  assert.ok(Array.isArray(f.lineBankKeys), 'lineBankKeys must be array');
  assert.ok(f.cpu, 'cpu behavior required');
  assert.ok(Array.isArray(f.cpu.aggressionCurve), 'aggressionCurve required');
  assert.ok(f.cpu.punishWindows, 'punishWindows required');
  assert.ok(['close', 'mid', 'far'].includes(f.cpu.preferredRange), 'preferredRange must be close/mid/far');
  assert.ok(typeof f.cpu.patience === 'number' && f.cpu.patience >= 0 && f.cpu.patience <= 1,
    'patience must be 0-1');
});

// locations.json shape
const locations = loadJson('data/locations.json');
assert.equal(locations.locations.length, 2, 'expected 2 locations');
locations.locations.forEach(loc => {
  assert.ok(loc.id && typeof loc.id === 'string', 'location id must be string');
  assert.ok(loc.name && typeof loc.name === 'string', 'location name must be string');
  assert.ok(loc.environmentalEvent, 'environmentalEvent required');
  assert.ok(loc.environmentalEvent.id && typeof loc.environmentalEvent.id === 'string', 'event id required');
  assert.ok(loc.environmentalEvent.trigger && typeof loc.environmentalEvent.trigger === 'string', 'event trigger required');
  assert.ok(typeof loc.environmentalEvent.cooldownSeconds === 'number', 'event cooldown required');
  assert.ok(loc.environmentalEvent.effect && loc.environmentalEvent.effect.type, 'event effect required');
});

// lines files shape and consistency
const linesDir = path.join(repoRoot, 'data', 'lines');
const lineFiles = fs.readdirSync(linesDir).filter(f => f.endsWith('.json'));
assert.equal(lineFiles.length, 4, 'expected 4 line bank files');
const lineFighterIds = [];
lineFiles.forEach(file => {
  const data = loadJson(path.join('data', 'lines', file));
  assert.ok(data.fighterId && typeof data.fighterId === 'string', 'line bank fighterId required');
  assert.ok(data.categories && typeof data.categories === 'object', 'line bank categories required');
  lineFighterIds.push(data.fighterId);
  Object.entries(data.categories).forEach(([catId, events]) => {
    assert.ok(topics.categories.some(c => c.id === catId), `unknown category ${catId} in ${file}`);
    ['lightHit', 'heavyHit', 'counter', 'block', 'whiff', 'combo', 'special'].forEach(eventType => {
      assert.ok(Array.isArray(events[eventType]) && events[eventType].length > 0,
        `${eventType} required in ${file} / ${catId}`);
      events[eventType].forEach(line => assert.equal(typeof line, 'string', 'line must be string'));
    });
  });
});

// Every fighter has a matching line bank file
fighters.fighters.forEach(f => {
  assert.ok(lineFighterIds.includes(f.id), `missing line bank for ${f.id}`);
});

// Every lineBankKey refers to a real category
fighters.fighters.forEach(f => {
  f.lineBankKeys.forEach(key => {
    assert.ok(topics.categories.some(c => c.id === key), `unknown lineBankKey ${key}`);
  });
});

console.log('Data schema tests passed.');
