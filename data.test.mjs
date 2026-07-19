import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// ---- load contentLoader.js (a classic-script IIFE) into a fake window ----
const vk = {config: {content: {maxCustomQuestionLength: 140}}};
new Function('window', readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8'))({VK: vk});
const {EVENT_TYPES, PLACEHOLDERS, sanitizeCustomQuestion, linesFor} = vk.content;

// ---- topics.json ----
const topics = readJson('data/topics.json');
assert.equal(topics.categories.length, 8, 'exactly 8 categories');
const categoryIds = new Set();
for (const c of topics.categories) {
  assert.match(c.id, /^[a-z_]+$/, `category id snake_case: ${c.id}`);
  assert.ok(!categoryIds.has(c.id), `duplicate category id: ${c.id}`);
  categoryIds.add(c.id);
  assert.ok(c.label.length > 0);
  assert.equal(c.questions.length, 3, `3 questions in ${c.id}`);
  const qids = new Set();
  for (const q of c.questions) {
    assert.match(q.id, /^[a-z_]+$/);
    assert.ok(!qids.has(q.id), `duplicate question id in ${c.id}: ${q.id}`);
    qids.add(q.id);
    assert.ok(q.text.length > 0 && q.text.length <= 140);
  }
  for (const key of ['stanceFor', 'stanceAgainst', 'evidence', 'expert']) {
    assert.ok(typeof c.vocab[key] === 'string' && c.vocab[key].length > 0,
      `vocab.${key} in ${c.id}`);
  }
}

// ---- fighters.json ----
const fighters = readJson('data/fighters.json');
assert.equal(fighters.fighters.length, 4, 'exactly 4 fighters');
const fighterIds = new Set();
for (const f of fighters.fighters) {
  assert.match(f.id, /^[a-z_]+$/);
  assert.ok(!fighterIds.has(f.id), `duplicate fighter id: ${f.id}`);
  fighterIds.add(f.id);
  assert.ok(f.name.length > 0 && f.tagline.length > 0);
  assert.ok(f.style.argument.length > 0 && f.style.combat.length > 0);
  for (const stat of ['power', 'speed']) {
    assert.ok(Number.isInteger(f.stats[stat]) && f.stats[stat] >= 1 && f.stats[stat] <= 10,
      `${f.id}.stats.${stat} in 1..10`);
  }
  assert.ok(f.special.id && f.special.name && f.special.description);
  assert.ok(f.cpu.aggressionCurve.length > 0, `${f.id} has an aggression curve`);
  let prevTick = 0;
  for (const seg of f.cpu.aggressionCurve) {
    assert.ok(Number.isInteger(seg.untilTick) && seg.untilTick > prevTick,
      `${f.id} aggression curve ticks strictly ascending`);
    prevTick = seg.untilTick;
    assert.ok(seg.aggression >= 0 && seg.aggression <= 1);
  }
  assert.ok(Number.isInteger(f.cpu.punishWindowTicks) && f.cpu.punishWindowTicks > 0);
  assert.ok(f.cpu.blockBias >= 0 && f.cpu.blockBias <= 1);
  assert.ok(['close', 'mid', 'far'].includes(f.cpu.preferredRange));
  // every fighter's line bank file must exist and parse (checked below too)
  readJson(`data/lines/${f.lineBank}.json`);
}

// ---- locations.json ----
const locations = readJson('data/locations.json');
assert.equal(locations.locations.length, 2, 'exactly 2 locations');
const EFFECT_TYPES = new Set(['dialogue_weight', 'event_weight_bonus']);
for (const l of locations.locations) {
  assert.match(l.id, /^[a-z_]+$/);
  assert.ok(l.name.length > 0 && l.description.length > 0);
  for (const key of ['sky', 'backdrop', 'floor', 'accent']) {
    assert.match(l.palette[key], /^#[0-9a-f]{6}$/i, `${l.id} palette.${key}`);
  }
  assert.ok(Array.isArray(l.parallaxLayers) && l.parallaxLayers.length > 0);
  assert.ok(l.event.id && l.event.name && l.event.announcement,
    `${l.id} scripted event complete`);
  assert.ok(Number.isInteger(l.event.trigger.atTick) && l.event.trigger.atTick > 0);
  assert.ok(EFFECT_TYPES.has(l.event.effect.type), `${l.id} effect type known`);
  if (l.event.effect.type === 'event_weight_bonus') {
    assert.ok(EVENT_TYPES.includes(l.event.effect.eventType));
    assert.ok(Number.isInteger(l.event.effect.durationTicks) && l.event.effect.durationTicks > 0);
  }
}

// ---- line banks ----
const placeholderRe = /\{([a-zA-Z]+)\}/g;
const bankFiles = readdirSync(join(root, 'data/lines')).filter((f) => f.endsWith('.json'));
assert.equal(bankFiles.length, 4, 'exactly 4 line banks');
for (const file of bankFiles) {
  const bank = readJson(`data/lines/${file}`);
  assert.equal(`${bank.fighter}.json`, file, `bank fighter matches filename: ${file}`);
  assert.ok(fighterIds.has(bank.fighter), `bank belongs to a real fighter: ${file}`);
  for (const type of EVENT_TYPES) {
    const lines = bank.events[type];
    assert.ok(Array.isArray(lines) && lines.length > 0, `${file} has ${type} lines`);
    for (const line of lines) {
      assert.ok(typeof line === 'string' && line.length > 0);
      for (const m of line.matchAll(placeholderRe)) {
        assert.ok(PLACEHOLDERS.includes(m[1]), `unknown placeholder {${m[1]}} in ${file}`);
      }
    }
  }
  for (const [cat, overrides] of Object.entries(bank.categoryOverrides ?? {})) {
    assert.ok(categoryIds.has(cat), `override category exists: ${cat} in ${file}`);
    for (const [type, lines] of Object.entries(overrides)) {
      assert.ok(EVENT_TYPES.includes(type), `override event type valid: ${type} in ${file}`);
      assert.ok(Array.isArray(lines) && lines.length > 0);
    }
  }
}

// ---- linesFor override semantics ----
const logician = readJson('data/lines/logician.json');
assert.deepEqual(
  linesFor(logician, 'philosophy', 'special'),
  logician.categoryOverrides.philosophy.special,
  'category override wins');
assert.deepEqual(
  linesFor(logician, 'food', 'special'),
  logician.events.special,
  'base bank applies without an override');
assert.deepEqual(linesFor(null, 'food', 'special'), [], 'null bank is safe');

// ---- sanitizeCustomQuestion ----
assert.equal(sanitizeCustomQuestion('  Is water   wet?  '), 'Is water wet?');
assert.equal(sanitizeCustomQuestion('<script>alert(1)</script>Is water wet?'), 'alert(1) Is water wet?',
  'tag markup is stripped; inner text survives as inert plain text');
assert.equal(sanitizeCustomQuestion('a < b > c'), 'a c',
  'tag-shaped spans are stripped whole — aggressive beats permissive');
assert.equal(sanitizeCustomQuestion('1 < 2 and 3 > 2 wait'), '1 2 wait',
  'even math-looking brackets go; no angle bracket ever survives');
assert.equal(sanitizeCustomQuestion('tab\tand\nnewline'), 'tab and newline');
assert.equal(sanitizeCustomQuestion(42), '');
assert.equal(sanitizeCustomQuestion('x'.repeat(500)).length, 140, 'capped at 140');
assert.ok(!sanitizeCustomQuestion('<img src=x onerror=alert(1)>hi').includes('<'));

// ---- load(): fetch path and fallback path ----
{
  // fetch stub that serves the real files from disk
  const vkFetch = {config: {content: {
    topicsUrl: 'data/topics.json', fightersUrl: 'data/fighters.json',
    locationsUrl: 'data/locations.json', linesUrlPrefix: 'data/lines/',
    maxCustomQuestionLength: 140,
  }}};
  const src = readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8');
  const diskFetch = (url) => Promise.resolve({ok: true, json: () => Promise.resolve(readJson(url))});
  new Function('window', 'fetch', src)({VK: vkFetch}, diskFetch);
  const loaded = await vkFetch.content.load();
  assert.equal(loaded.topics.length, 8);
  assert.equal(loaded.fighters.length, 4);
  assert.equal(loaded.locations.length, 2);
  assert.equal(Object.keys(loaded.lines).length, 4);
  for (const f of loaded.fighters) {
    assert.ok(loaded.lines[f.lineBank], `bank loaded for ${f.id}`);
    for (const type of EVENT_TYPES) {
      assert.ok(loaded.lines[f.lineBank].events[type].length > 0);
    }
  }

  // fetch that always fails (the file:// case) must still resolve via fallback
  const vkFallback = {config: vkFetch.config};
  const deadFetch = () => Promise.reject(new Error('file:// blocked'));
  const warn = console.warn;
  console.warn = () => {};
  new Function('window', 'fetch', src)({VK: vkFallback}, deadFetch);
  const fallback = await vkFallback.content.load();
  console.warn = warn;
  assert.ok(fallback.topics.length >= 1, 'fallback topics keep the loop alive');
  assert.ok(fallback.fighters.length >= 2, 'fallback fighters keep the loop alive');
  assert.ok(fallback.locations.length >= 1, 'fallback location keeps the loop alive');
  for (const f of fallback.fighters) {
    assert.ok(fallback.lines[f.lineBank], `fallback bank exists for ${f.id}`);
  }
}

// ---- reachable-but-malformed content must fall back, not brick the boot ----
{
  const vkBad = {config: {content: {
    topicsUrl: 'data/topics.json', fightersUrl: 'data/fighters.json',
    locationsUrl: 'data/locations.json', linesUrlPrefix: 'data/lines/',
    maxCustomQuestionLength: 140,
  }}};
  const src = readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8');
  // topics.json is served but garbage; fighters get one invalid entry (bad
  // aggression curve) alongside the real ones; everything else is real.
  const badFighters = readJson('data/fighters.json');
  badFighters.fighters = [
    ...badFighters.fighters,
    {...badFighters.fighters[0], id: 'broken',
      cpu: {...badFighters.fighters[0].cpu,
        aggressionCurve: [{untilTick: 100, aggression: 0.5}, {untilTick: 50, aggression: 2}]}},
  ];
  const mixedFetch = (url) => Promise.resolve({ok: true, json: () => Promise.resolve(
    url === 'data/topics.json' ? {categories: [{id: 'no_vocab'}]} :
    url === 'data/fighters.json' ? badFighters : readJson(url))});
  const warn = console.warn;
  console.warn = () => {};
  new Function('window', 'fetch', src)({VK: vkBad}, mixedFetch);
  const mixed = await vkBad.content.load();
  console.warn = warn;
  assert.ok(mixed.topics.length >= 1, 'malformed topics.json degrades to fallback');
  assert.equal(mixed.topics[0].id, 'food', 'fallback topics served');
  assert.equal(mixed.fighters.length, 4, 'invalid fighter entry dropped, valid ones kept');
  assert.ok(!mixed.fighters.some((f) => f.id === 'broken'));
}

// ---- bank fighter field never overrides the bank key ----
{
  const vkBank = {config: {content: {
    topicsUrl: 'data/topics.json', fightersUrl: 'data/fighters.json',
    locationsUrl: 'data/locations.json', linesUrlPrefix: 'data/lines/',
    maxCustomQuestionLength: 140,
  }}};
  const src = readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8');
  const lyingBank = {...readJson('data/lines/logician.json'), fighter: 'impostor'};
  const bankFetch = (url) => Promise.resolve({ok: true, json: () => Promise.resolve(
    url === 'data/lines/logician.json' ? lyingBank : readJson(url))});
  const warn = console.warn;
  console.warn = () => {};
  new Function('window', 'fetch', src)({VK: vkBank}, bankFetch);
  const loaded = await vkBank.content.load();
  console.warn = warn;
  assert.equal(loaded.lines.logician.fighter, 'logician',
    'bank key is authoritative over a mismatched fighter field');
}

// ---- a bank missing a required event type degrades to the fallback bank ----
{
  const vkHollow = {config: {content: {
    topicsUrl: 'data/topics.json', fightersUrl: 'data/fighters.json',
    locationsUrl: 'data/locations.json', linesUrlPrefix: 'data/lines/',
    maxCustomQuestionLength: 140,
  }}};
  const src = readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8');
  const hollowBank = structuredClone(readJson('data/lines/logician.json'));
  delete hollowBank.events.whiff;
  const hollowFetch = (url) => Promise.resolve({ok: true, json: () => Promise.resolve(
    url === 'data/lines/logician.json' ? hollowBank : readJson(url))});
  const warn = console.warn;
  console.warn = () => {};
  new Function('window', 'fetch', src)({VK: vkHollow}, hollowFetch);
  const loaded = await vkHollow.content.load();
  console.warn = warn;
  for (const type of EVENT_TYPES) {
    assert.ok(loaded.lines.logician.events[type].length > 0,
      `fallback bank fills required event type ${type}`);
  }
  assert.equal(loaded.lines.logician.fighter, 'logician');
}

// ---- served content short of the R1 counts degrades to fallback ----
{
  const vkShort = {config: {content: {
    topicsUrl: 'data/topics.json', fightersUrl: 'data/fighters.json',
    locationsUrl: 'data/locations.json', linesUrlPrefix: 'data/lines/',
    maxCustomQuestionLength: 140,
  }}};
  const src = readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8');
  const shortTopics = {categories: readJson('data/topics.json').categories.slice(0, 2)};
  const shortFetch = (url) => Promise.resolve({ok: true, json: () => Promise.resolve(
    url === 'data/topics.json' ? shortTopics : readJson(url))});
  const warn = console.warn;
  console.warn = () => {};
  new Function('window', 'fetch', src)({VK: vkShort}, shortFetch);
  const loaded = await vkShort.content.load();
  console.warn = warn;
  assert.equal(loaded.topics[0].id, 'food');
  assert.equal(loaded.topics.length, 1,
    'a valid-but-partial topics payload falls back to the built-in set');
}

// ---- a fighter whose line bank 404s is dropped, never given fake lines ----
{
  const vkMissing = {config: {content: {
    topicsUrl: 'data/topics.json', fightersUrl: 'data/fighters.json',
    locationsUrl: 'data/locations.json', linesUrlPrefix: 'data/lines/',
    maxCustomQuestionLength: 140,
  }}};
  const src = readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8');
  const extraFighters = readJson('data/fighters.json');
  extraFighters.fighters.push({...extraFighters.fighters[0],
    id: 'mystery_guest', lineBank: 'mystery'});
  const missingFetch = (url) =>
    url === 'data/lines/mystery.json'
      ? Promise.resolve({ok: false, status: 404})
      : Promise.resolve({ok: true, json: () => Promise.resolve(
          url === 'data/fighters.json' ? extraFighters : readJson(url))});
  const warn = console.warn;
  console.warn = () => {};
  new Function('window', 'fetch', src)({VK: vkMissing}, missingFetch);
  const loaded = await vkMissing.content.load();
  console.warn = warn;
  assert.equal(loaded.fighters.length, 4, 'fighter with unloadable bank dropped');
  assert.ok(!loaded.fighters.some((f) => f.id === 'mystery_guest'));
  assert.ok(!('mystery' in loaded.lines), 'no synthesized bank for the missing key');
}

// ---- invalid override lines lose to the base bank ----
{
  const vkOverride = {config: {content: {
    topicsUrl: 'data/topics.json', fightersUrl: 'data/fighters.json',
    locationsUrl: 'data/locations.json', linesUrlPrefix: 'data/lines/',
    maxCustomQuestionLength: 140,
  }}};
  const src = readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8');
  const badOverrideBank = structuredClone(readJson('data/lines/logician.json'));
  badOverrideBank.categoryOverrides.philosophy.special = [42, '', '{expertt} agrees'];
  const overrideFetch = (url) => Promise.resolve({ok: true, json: () => Promise.resolve(
    url === 'data/lines/logician.json' ? badOverrideBank : readJson(url))});
  const warn = console.warn;
  console.warn = () => {};
  new Function('window', 'fetch', src)({VK: vkOverride}, overrideFetch);
  const loaded = await vkOverride.content.load();
  console.warn = warn;
  const bank = loaded.lines.logician;
  assert.ok(!bank.categoryOverrides.philosophy?.special,
    'override with no valid lines is discarded');
  assert.deepEqual(vkOverride.content.linesFor(bank, 'philosophy', 'special'),
    bank.events.special, 'base bank wins over an invalid override');
}

// ---- a typo'd placeholder invalidates the line; a mute bucket falls back ----
{
  const vkTypo = {config: {content: {
    topicsUrl: 'data/topics.json', fightersUrl: 'data/fighters.json',
    locationsUrl: 'data/locations.json', linesUrlPrefix: 'data/lines/',
    maxCustomQuestionLength: 140,
  }}};
  const src = readFileSync(join(root, 'src/engine/contentLoader.js'), 'utf8');
  const typoBank = structuredClone(readJson('data/lines/logician.json'));
  typoBank.events.whiff = ['{expertt} would disagree.'];
  const typoFetch = (url) => Promise.resolve({ok: true, json: () => Promise.resolve(
    url === 'data/lines/logician.json' ? typoBank : readJson(url))});
  const warn = console.warn;
  console.warn = () => {};
  new Function('window', 'fetch', src)({VK: vkTypo}, typoFetch);
  const loaded = await vkTypo.content.load();
  console.warn = warn;
  assert.ok(loaded.lines.logician.events.whiff.length > 0,
    'bank with only-invalid lines for an event degrades to fallback');
  assert.ok(!loaded.lines.logician.events.whiff[0].includes('{expertt}'));
}

console.log('Data tests passed.');
