/*
 * tests.js — inline browser harness for combat, RNG, ledger, and determinism.
 *
 * Loaded by tests.html. No external framework; a tiny assert helper is enough.
 */
(function (VK) {
  "use strict";

  var results = document.getElementById("results");
  var logEl = document.getElementById("log");
  var passed = 0;
  var failed = 0;

  function assert(cond, msg) {
    if (cond) {
      passed++;
      appendResult("pass", "✓ " + (msg || "assertion"));
    } else {
      failed++;
      appendResult("fail", "✗ " + (msg || "assertion failed"));
      throw new Error("Assertion failed: " + msg);
    }
  }

  function assertEqual(a, b, msg) {
    assert(a === b, msg + " (expected " + b + ", got " + a + ")");
  }

  function assertApprox(a, b, eps, msg) {
    assert(Math.abs(a - b) <= eps, msg + " (expected ~" + b + ", got " + a + ")");
  }

  function appendResult(cls, text) {
    var div = document.createElement("div");
    div.className = cls;
    div.textContent = text;
    results.appendChild(div);
  }

  function log(obj) {
    var line = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    logEl.textContent += line + "\n";
  }

  // --- Tests begin here ---

  function testRngDeterminism() {
    var a = VK.rng.create("seed-42");
    var b = VK.rng.create("seed-42");
    for (var i = 0; i < 100; i++) {
      assertEqual(a.next(), b.next(), "rng " + i);
    }
    var s1 = a.stream("cpu");
    var s2 = a.stream("dialogue");
    assert(s1.next() !== s2.next(), "different streams diverge");
    var s1b = VK.rng.create("seed-42").stream("cpu");
    // Both s1 and s1b are fresh streams from the same seed/label, so their
    // first draw after creation must match.
    assertEqual(s1.next(), s1b.next(), "same stream label is deterministic");
  }

  function testLedger() {
    var ledger = VK.ledger.create({ seed: "abc", player: "p", opponent: "o" });
    assertEqual(ledger.events.length, 1, "ledger starts with header");
    assertEqual(ledger.events[0].type, "match_start", "header type");
    VK.ledger.push(ledger, { type: "hit", tick: 5 });
    assertEqual(ledger.events.length, 2, "ledger after push");
    assertEqual(VK.ledger.last(ledger).tick, 5, "last event");
  }

  function testFighter() {
    var f = VK.combat.makeFighter({ id: "logician", name: "Logician" }, "left", 200);
    assertEqual(f.x, 200, "fighter x");
    assertEqual(f.health, VK.config.fighter.maxHealth, "fighter health");
    assertEqual(f.facing, 1, "left fighter faces right");
  }

  function testAttackAndHit() {
    var moves = [
      { id: "light_jab", kind: "light", damage: 5, startup: 2, active: 4, recovery: 6, range: 70, knockback: 20, meterGain: 5 },
    ];
    var p = VK.combat.makeFighter({ id: "p", name: "P" }, "left", 100);
    var e = VK.combat.makeFighter({ id: "e", name: "E" }, "right", 200);
    VK.combat.startAttack(p, "light_jab", moves);
    for (var i = 0; i < 3; i++) VK.combat.updateFighter(p, VK.config.combat.fixedStep);
    var ev = VK.combat.resolveAttacks(p, e, 3);
    assert(ev !== null, "attack connects");
    assertEqual(ev.type, "hit", "event is hit");
    assertEqual(ev.damage, 5, "damage value");
    assert(e.health < VK.config.fighter.maxHealth, "defender loses health");
  }

  function testBlockReducesDamage() {
    var moves = [
      { id: "heavy_cross", kind: "heavy", damage: 12, startup: 1, active: 4, recovery: 6, range: 90, knockback: 40, meterGain: 10 },
    ];
    var p = VK.combat.makeFighter({ id: "p", name: "P" }, "left", 100);
    var e = VK.combat.makeFighter({ id: "e", name: "E" }, "right", 200);
    VK.combat.startAttack(p, "heavy_cross", moves);
    VK.combat.setBlocking(e, true);
    for (var i = 0; i < 2; i++) VK.combat.updateFighter(p, VK.config.combat.fixedStep);
    var ev = VK.combat.resolveAttacks(p, e, 2);
    assertEqual(ev.type, "blocked", "blocked event");
    assert(ev.damage < 12, "blocked damage reduced");
    assert(e.isBlockstun > 0, "defender enters blockstun");
  }

  function testCounter() {
    var moves = [
      { id: "light_jab", kind: "light", damage: 5, startup: 6, active: 4, recovery: 10, range: 70, knockback: 20, meterGain: 5 },
    ];
    var p = VK.combat.makeFighter({ id: "p", name: "P" }, "left", 100);
    var e = VK.combat.makeFighter({ id: "e", name: "E" }, "right", 200);
    VK.combat.startAttack(p, "light_jab", moves);
    VK.combat.startAttack(e, "light_jab", moves);
    // Advance both into active frames.
    for (var i = 0; i < 8; i++) {
      VK.combat.updateFighter(p, VK.config.combat.fixedStep);
      VK.combat.updateFighter(e, VK.config.combat.fixedStep);
    }
    var evP = VK.combat.resolveAttacks(p, e, 8);
    var evE = VK.combat.resolveAttacks(e, p, 8);
    // One will hit the other during startup -> counter.
    var hit = evP || evE;
    assert(hit !== null, "someone connects");
    assert(hit.countered === true || (hit.type === "counter"), "counter detection");
  }

  function testDeterministicMatch() {
    var moves = [
      { id: "light_jab", kind: "light", damage: 8, startup: 2, active: 6, recovery: 6, range: 80, knockback: 30, meterGain: 5 },
      { id: "heavy_cross", kind: "heavy", damage: 14, startup: 4, active: 6, recovery: 10, range: 90, knockback: 60, meterGain: 10 },
      { id: "special_finisher", kind: "special", damage: 22, startup: 3, active: 8, recovery: 12, range: 100, knockback: 90, meterCost: 100, meterGain: 0 },
    ];
    var pDef = { id: "logician", name: "Logician", palette: "#4aa3e4", stats: {}, behavior: {} };
    var eDef = { id: "demagogue", name: "Demagogue", palette: "#c8102e", stats: {}, behavior: {} };

    function run(seed) {
      var match = VK.state.makeMatch(seed, pDef, eDef, null);
      match.moves = moves;
      match = VK.state.start(match);
      match.moves = moves;
      for (var i = 0; i < 120 && match.phase === "fighting"; i++) {
        if (i % 20 === 0) VK.state.bufferInput(match, { type: "attack", kind: "light" });
        VK.state.update(match);
      }
      return match;
    }

    var m1 = run("seed-X");
    var m2 = run("seed-X");
    assertEqual(m1.phase, m2.phase, "phases match");
    assertEqual(m1.tick, m2.tick, "ticks match");
    assertEqual(m1.ledger.events.length, m2.ledger.events.length, "ledger length matches");
    for (var j = 0; j < m1.ledger.events.length; j++) {
      assertEqual(m1.ledger.events[j].type, m2.ledger.events[j].type, "ledger event " + j);
    }
  }

  function testCpuPlaysMatch() {
    var moves = [
      { id: "light_jab", kind: "light", damage: 5, startup: 2, active: 4, recovery: 6, range: 80, knockback: 30, meterGain: 5 },
      { id: "heavy_cross", kind: "heavy", damage: 10, startup: 4, active: 4, recovery: 8, range: 90, knockback: 60, meterGain: 10 },
      { id: "special_finisher", kind: "special", damage: 20, startup: 3, active: 6, recovery: 10, range: 100, knockback: 80, meterCost: 100, meterGain: 0 },
    ];
    var pDef = {
      id: "logician",
      name: "Logician",
      palette: "#4aa3e4",
      stats: {},
      behavior: { aggression: [{ until: 999, value: 0.5 }], punchWindow: { min: 0.4, max: 1.0 }, punishDistance: 90, blockPreference: 0.2 },
    };
    var eDef = {
      id: "demagogue",
      name: "Demagogue",
      palette: "#c8102e",
      stats: {},
      behavior: { aggression: [{ until: 999, value: 0.8 }], punchWindow: { min: 0.4, max: 1.0 }, punishDistance: 90, blockPreference: 0.1 },
    };
    var match = VK.state.makeMatch("cpu-test", pDef, eDef, null);
    match.moves = moves;
    match = VK.state.start(match);
    match.moves = moves;

    while (match.phase === "fighting" && match.tick < 5400) {
      VK.state.update(match);
    }

    assert(match.phase === "ended", "match reaches end");
    assert(match.ledger.events.length >= 2, "ledger contains events");
    var hits = match.ledger.events.filter(function (e) { return e.type === "hit" || e.type === "blocked" || e.type === "counter"; });
    assert(hits.length > 0, "CPU and/or combat produced hits");
  }

  function runAll() {
    var tests = [
      testRngDeterminism,
      testLedger,
      testFighter,
      testAttackAndHit,
      testBlockReducesDamage,
      testCounter,
      testDeterministicMatch,
      testCpuPlaysMatch,
    ];
    tests.forEach(function (t) {
      try {
        t();
      } catch (err) {
        failed++;
        appendResult("fail", "Exception in " + t.name + ": " + err.message);
      }
    });

    var summary = document.createElement("h2");
    summary.textContent = passed + " passed, " + failed + " failed";
    summary.className = failed === 0 ? "pass" : "fail";
    results.insertBefore(summary, results.firstChild);
    log("Done.");
  }

  runAll();
})(window.VK);
