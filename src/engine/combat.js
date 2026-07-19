/*
 * combat.js — pure rules. No canvas, no DOM, no timers.
 *
 * Two ways an argument resolves:
 *   - resolveMove:        the PLAYER attacks. The enemy defends deterministically
 *                         (a composed enemy catches a risky/fallacious attack).
 *   - resolveTelegraphed: the ENEMY attacks after a wind-up. The player defends
 *                         by timing (did they call it out in the window?).
 *
 * Both mutate attacker.composure / fighter.health so all state changes stay in
 * one place. Keeping this pure makes the mechanic easy to test and tune.
 */
(function (VK) {
  "use strict";

  // Composure it costs to throw a given move.
  function moveCost(move) {
    return move.damage * VK.config.combat.composureCostPerDamage;
  }

  // PLAYER-initiated argument against a self-defending enemy.
  function resolveMove(attacker, defender, move) {
    var cost = moveCost(move);

    // Not enough composure to make the argument land — it fizzles.
    if (attacker.composure < cost) {
      return fizzle(attacker, move);
    }
    attacker.composure = clamp(attacker.composure - cost, 0, maxComposure());

    // Does the defender catch the weak point? A high-risk move against a
    // composed defender gets countered. Deterministic for a predictable
    // starter; swap in probability/skill later.
    var exposed = move.risk >= 6 && defender.composure >= 45;
    if (exposed) {
      var counterDmg = Math.round(move.risk * VK.config.combat.counterMultiplier);
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

  // ENEMY-initiated argument the player had a window to rebut.
  // `defended` = the player called it out in time.
  function resolveTelegraphed(attacker, defender, move, defended) {
    var cost = moveCost(move);
    if (attacker.composure < cost) {
      return fizzle(attacker, move);
    }
    attacker.composure = clamp(attacker.composure - cost, 0, maxComposure());

    if (defended) {
      var counterDmg = Math.round(move.risk * VK.config.combat.counterMultiplier);
      attacker.health = clamp(attacker.health - counterDmg, 0, maxHealth());
      return {
        type: "riposte",
        attacker: attacker.id,
        defender: defender.id,
        move: move,
        damage: counterDmg,
        message: defender.name + " rebuts the " + move.name + "! " + (move.counter || ""),
      };
    }

    defender.health = clamp(defender.health - move.damage, 0, maxHealth());
    return {
      type: "hit",
      attacker: attacker.id,
      defender: defender.id,
      move: move,
      damage: move.damage,
      message: attacker.name + " lands a " + move.name + ".",
    };
  }

  function fizzle(attacker, move) {
    return {
      type: "fizzle",
      attacker: attacker.id,
      move: move,
      message: attacker.name + " fumbles: not enough composure.",
    };
  }

  function maxHealth() { return VK.config.fighter.maxHealth; }
  function maxComposure() { return VK.config.fighter.maxComposure; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  VK.combat = {
    moveCost: moveCost,
    resolveMove: resolveMove,
    resolveTelegraphed: resolveTelegraphed,
    clamp: clamp,
  };
})(window.VK);
