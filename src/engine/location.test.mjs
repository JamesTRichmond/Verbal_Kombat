import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Provide a file:// fetch polyfill because Node's fetch does not support file URLs.
const originalFetch = globalThis.fetch;
globalThis.fetch = async function fetchPolyfill(url) {
  const path = url.startsWith('file://') ? url.slice('file://'.length) : url;
  const body = readFileSync(path, 'utf8');
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
  };
};

// Override config paths to absolute file URLs so Node can fetch them.
await import(fileUrl(join(root, 'src', 'core', 'config.js')));
const VK = global.window.VK;
VK.config.dataUrl = fileUrl(join(root, 'data', 'fallacies.json'));
VK.config.locationsUrl = fileUrl(join(root, 'data', 'locations.json'));

// Load dataLoader after paths are set.
await import(fileUrl(join(root, 'src', 'engine', 'dataLoader.js')));

const locationsJson = JSON.parse(readFileSync(join(root, 'data', 'locations.json'), 'utf8'));
const locations = VK.loadLocations();
assert.ok(locations instanceof Promise, 'loadLocations returns a Promise');
const resolved = await locations;
assert.equal(resolved.length, locationsJson.locations.length, 'all valid arenas loaded');
assert.ok(resolved.find(l => l.id === 'forum'), 'The Forum exists');
assert.ok(resolved.find(l => l.id === 'studio'), 'The Studio exists');

// Validate schema for each location.
resolved.forEach(loc => {
  assert.ok(loc.id && loc.name && loc.description, 'location has id, name, description');
  assert.ok(loc.palette && loc.palette.skyTop && loc.palette.skyBottom && loc.palette.floor && loc.palette.accent, 'palette complete');
  assert.ok(loc.event && loc.event.id && loc.event.name && typeof loc.event.interval === 'number' && loc.event.effect, 'event complete');
});

console.log('Location data tests passed.');
