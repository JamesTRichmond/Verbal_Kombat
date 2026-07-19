/*
 * combat.js — pure rules. No canvas, no DOM, no timers.
 *
 * Given an attacker, a defender, and the argument move being thrown, decide
 * what happens: damage dealt, composure spent, and whether the defender
 * counters (punishing a risky/fallacious attack). Keeping this pure makes the
 * mechanic easy to test and tune independently of rendering.
 */
(function (VK) {
  "use strict";

  // Resolve a single argument. Returns an event object describing the outcome.
  // Mutates attacker.composure / defender.health / attacker.meter /
  // attacker.chain / defender.chain so state stays in one place.
  function resolveMove(attacker, defender, move) {
    var cfg = VK.config.combat;
    var cost = move.damage * cfg.composureCostPerDamage;

    // Not enough composure to make the argument land — it fizzles.
    if (attacker.composure < cost) {
      attacker.chain = 0;
      return {
        type: "fizzle",
        attacker: attacker.id,
        move: move,
        message: attacker.name + " fumbles: not enough composure.",
      };
    }

    attacker.composure = clamp(attacker.composure - cost, 0, maxComposure());

    // Does the defender catch the weak point? A high-risk move against a
    // composed defender gets countered. Deterministic for a predictable
    // starter; swap in probability/skill later.
    var exposed =
      move.risk >= cfg.counterRiskThreshold &&
      defender.composure >= cfg.counterComposureThreshold;

    if (exposed) {
      var counterDmg = Math.round(move.risk * cfg.counterMultiplier);
      attacker.health = clamp(attacker.health - counterDmg, 0, maxHealth());
      attacker.chain = 0;
      return {
        type: "countered",
        attacker: attacker.id,
        defender: defender.id,
        move: move,
        damage: counterDmg,
        message: defender.name + " counters! " + (move.counter || ""),
      };
    }

    // Clean hit. Spend a full meter on a special, or finish a 3-hit chain
    // with a combo; otherwise it's a single hit.
    var meterBefore = attacker.meter;
    var maxM = maxMeter();
    var event;

    if (meterBefore >= maxM) {
      var specialDmg = Math.round(move.damage * cfg.specialDamageMultiplier);
      defender.health = clamp(defender.health - specialDmg, 0, maxHealth());
      attacker.meter = 0;
      attacker.chain = 0;
      defender.chain = 0;
      event = {
        type: "special",
        attacker: attacker.id,
        defender: defender.id,
        move: move,
        damage: specialDmg,
        meterBefore: meterBefore,
        meterAfter: 0,
        message: attacker.name + ' unleashes a special: "' + (move.example || move.name) + '"',
      };
    } else if (attacker.chain + 1 >= cfg.chainLength) {
      var comboDmg = move.damage + cfg.comboBonusDamage;
      defender.health = clamp(defender.health - comboDmg, 0, maxHealth());
      attacker.meter = clamp(attacker.meter + cfg.meterBuildPerHit + cfg.comboMeterBonus, 0, maxM);
      attacker.chain = 0;
      defender.chain = 0;
      event = {
        type: "combo",
        attacker: attacker.id,
        defender: defender.id,
        move: move,
        damage: comboDmg,
        meterBefore: meterBefore,
        meterAfter: attacker.meter,
        chain: cfg.chainLength,
        message: attacker.name + ' lands a 3-hit combo: "' + (move.example || move.name) + '"',
      };
    } else {
      defender.health = clamp(defender.health - move.damage, 0, maxHealth());
      attacker.meter = clamp(attacker.meter + cfg.meterBuildPerHit, 0, maxM);
      attacker.chain += 1;
      defender.chain = 0;
      event = {
        type: "hit",
        attacker: attacker.id,
        defender: defender.id,
        move: move,
        damage: move.damage,
        meterBefore: meterBefore,
        meterAfter: attacker.meter,
        chain: attacker.chain,
        message: attacker.name + ': "' + (move.example || move.name) + '"',
      };
    }

    return event;
  }

  function maxHealth() { return VK.config.fighter.maxHealth; }
  function maxComposure() { return VK.config.fighter.maxComposure; }
  function maxMeter() { return VK.config.fighter.maxMeter; }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  VK.combat = { resolveMove: resolveMove, clamp: clamp };
})(window.VK);
