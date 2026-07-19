import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Load the namespace, config, and combat module into a fresh sandbox so we
// can unit-test the browser globals without a browser.
const root = new URL("../../", import.meta.url).pathname;
const load = (path) => fs.readFileSync(root + path, "utf8");

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(load("src/core/namespace.js"), context);
vm.runInContext(load("src/core/config.js"), context);
vm.runInContext(load("src/engine/combat.js"), context);

const VK = context.window.VK;
const { resolveMove, clamp } = VK.combat;

function fighter(id, name) {
  return { id, name, health: 100, composure: 100 };
}

function move(damage, risk, example, counter) {
  return { id: "test", name: "Test", damage, risk, example, counter };
}

// A low-risk move should land cleanly and reduce defender health.
const p1 = fighter("p1", "A");
const e1 = fighter("e1", "B");
const hit = resolveMove(p1, e1, move(10, 1, "hit line", "counter line"));
assert.equal(hit.type, "hit");
assert.equal(e1.health, 90);
assert.equal(p1.health, 100);

// A high-risk move against a composed defender should be countered.
const p2 = fighter("p2", "A");
const e2 = fighter("e2", "B");
const countered = resolveMove(p2, e2, move(10, 10, "risky", "gotcha"));
assert.equal(countered.type, "countered");
assert.ok(p2.health < 100);
assert.equal(e2.health, 100);

// Composure cost is deducted.
const p3 = fighter("p3", "A");
const e3 = fighter("e3", "B");
resolveMove(p3, e3, move(10, 1, "x", "y"));
assert.equal(p3.composure, 85); // 100 - 10 * 1.5

// Fizzle when attacker lacks composure.
const p4 = fighter("p4", "A");
p4.composure = 1;
const e4 = fighter("e4", "B");
const fizzle = resolveMove(p4, e4, move(10, 1, "x", "y"));
assert.equal(fizzle.type, "fizzle");
assert.equal(e4.health, 100);

// clamp helper works.
assert.equal(clamp(5, 0, 10), 5);
assert.equal(clamp(-2, 0, 10), 0);
assert.equal(clamp(12, 0, 10), 10);

console.log("Combat tests passed.");
