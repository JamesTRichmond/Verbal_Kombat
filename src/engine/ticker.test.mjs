import assert from "node:assert/strict";
import { readFileSync } from "fs";

const win = { VK: {} };
function loadScript(path) {
  const code = readFileSync(path, "utf8");
  const fn = new Function("window", code);
  fn(win);
}

loadScript("src/core/namespace.js");
loadScript("src/core/config.js");
loadScript("src/engine/ticker.js");
loadScript("src/engine/dialogue.js");

const { ticker, dialogue } = win.VK;

// Throttle: nothing displayed until interval elapses.
const t = ticker.create(2.5, 3);
assert.equal(ticker.currentLine(t), null);
ticker.enqueue(t, { text: "first", event: { type: "hit" } });
ticker.update(t, 2.4);
assert.equal(ticker.currentLine(t), null, "line waits for interval");
ticker.update(t, 0.2);
assert.equal(ticker.currentLine(t).text, "first", "line shown after interval");

// Advance: next queued line replaces current after another interval.
ticker.enqueue(t, { text: "second", event: { type: "hit" } });
ticker.update(t, 2.5);
assert.equal(ticker.currentLine(t).text, "second", "queued line advances");

// Drop rule: oldest undisplayed lines are dropped when maxQueue is exceeded.
const u = ticker.create(2.5, 2);
ticker.enqueue(u, { text: "a", event: { type: "hit" } });
ticker.enqueue(u, { text: "b", event: { type: "hit" } });
ticker.enqueue(u, { text: "c", event: { type: "hit" } });
assert.equal(ticker.pendingCount(u), 2, "queue cap enforced");
ticker.update(u, 2.6);
assert.equal(ticker.currentLine(u).text, "b", "oldest undisplayed dropped");

// Every displayed line cites a causing event.
const event = { type: "hit", attacker: { id: "player", name: "You" }, move: { example: "Test.", name: "T" } };
const line = dialogue.pickLine(event, "player", "jab", 0);
assert.ok(line.text.includes("You"), "line references speaker");
assert.equal(line.event, event, "line cites causing event");
assert.equal(line.category, "jab");

// Combo lines are visibly more developed than jab lines.
const comboEvent = { type: "combo", attacker: { id: "player", name: "You" }, defender: { id: "enemy", name: "Sophist" }, move: { example: "A.", name: "T" } };
const comboLine = dialogue.pickLine(comboEvent, "player", "combo", 0);
assert.ok(comboLine.text.length > line.text.length, "combo line longer than jab");
assert.ok(comboLine.text.split(" ").length > line.text.split(" ").length, "combo line has more words");

// Counter and KO categories resolve correctly.
const counterEvent = { type: "countered", attacker: { id: "enemy", name: "Sophist" }, defender: { id: "player", name: "You" }, move: { counter: "Hardly." } };
const counterLine = dialogue.pickLine(counterEvent, "player", dialogue.eventCategory(counterEvent), 0);
assert.ok(counterLine.text.includes("Hardly."), "counter line renders rebuttal");

const koEvent = { type: "ko", winner: { id: "player", name: "You" } };
const koLine = dialogue.pickLine(koEvent, "player", dialogue.eventCategory(koEvent), 0);
assert.ok(koLine.text.includes("You"), "ko line references winner");

console.log("Ticker + dialogue tests passed.");
