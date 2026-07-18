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
  // Mutates attacker.composure / defender.health so state stays in one place.
  function resolveMove(attacker, defender, move) {
    var cfg = VK.config.combat;
    var cost = move.damage * cfg.composureCostPerDamage;

    // Not enough composure to make the argument land — it fizzles.
    if (attacker.composure < cost) {
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
    var exposed = move.risk >= 6 && defender.composure >= 45;

    if (exposed) {
      var counterDmg = Math.round(move.risk * cfg.counterMultiplier);
      defender.health = clamp(defender.health - 0, 0, maxHealth()); // no self-hit
      attacker.health = clamp(attacker.health - counterDmg, 0, maxHealth());
      return {
        type: "countered",
        attacker: attacker.id,
        defender: defender.id,
        move: move,
        damage: counterDmg,
        message: defender.name + " counters! " + (move.counter || ""),
      };
    }

    // Clean hit.
    defender.health = clamp(defender.health - move.damage, 0, maxHealth());
    return {
      type: "hit",
      attacker: attacker.id,
      defender: defender.id,
      move: move,
      damage: move.damage,
      message: attacker.name + ': "' + (move.example || move.name) + '"',
    };
  }

  function maxHealth() { return VK.config.fighter.maxHealth; }
  function maxComposure() { return VK.config.fighter.maxComposure; }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  VK.combat = { resolveMove: resolveMove, clamp: clamp };
})(window.VK);
