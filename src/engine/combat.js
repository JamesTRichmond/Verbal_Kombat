/*
 * combat.js — pure rules for real-time-lite fighting.
 *
 * No canvas, no DOM, no timers. Exposes helpers to create/update fighters,
 * resolve attacks, and build ledger events. All state mutation happens here
 * so tests can exercise the whole ruleset deterministically.
 */
(function (VK) {
  "use strict";

  var MOVE_IDS = { light: "light_jab", heavy: "heavy_cross", special: "special_finisher" };

  function makeFighter(def, side, x) {
    return {
      id: def.id,
      name: def.name,
      side: side, // "left" | "right"
      x: x,
      y: 0,               // y=0 means on the floor; negative values are airborne
      vx: 0,
      vy: 0,
      facing: side === "left" ? 1 : -1,
      width: (def.stats && def.stats.reach ? 44 + def.stats.reach * 2 : VK.config.fighter.width),
      height: VK.config.fighter.height,
      health: VK.config.fighter.maxHealth,
      meter: 0,
      palette: def.palette || (side === "left" ? "#4aa3e4" : "#c8102e"),
      isBlocking: false,
      isHitstun: 0,       // frames remaining in hitstun
      isBlockstun: 0,     // frames remaining in blockstun
      attack: null,       // { move, frame, hasHit }
      comboCount: 0,
      comboTimer: 0,
      stats: def.stats || {},
      behavior: def.behavior || null,
    };
  }

  function getMoveById(id, moves) {
    for (var i = 0; i < moves.length; i++) {
      if (moves[i].id === id) return moves[i];
    }
    return null;
  }

  function moveIdForInput(input) {
    return MOVE_IDS[input];
  }

  function canAct(fighter) {
    return fighter.isHitstun <= 0 && fighter.isBlockstun <= 0 && !fighter.attack;
  }

  function canBlock(fighter) {
    return fighter.isHitstun <= 0 && !fighter.attack;
  }

  function startAttack(fighter, move, moves) {
    if (!canAct(fighter)) return null;
    var m = typeof move === "string" ? getMoveById(move, moves) : move;
    if (!m) return null;

    if (m.kind === "special") {
      if (fighter.meter < m.meterCost) return null;
      fighter.meter -= m.meterCost;
    }

    fighter.attack = {
      move: m,
      frame: 0,
      hasHit: false,
    };
    fighter.isBlocking = false;
    return m;
  }

  function setBlocking(fighter, blocking) {
    fighter.isBlocking = blocking && canBlock(fighter);
    if (fighter.isBlocking && fighter.attack) {
      fighter.attack = null;
    }
  }

  function updateFighter(fighter, dt) {
    var cfg = VK.config.fighter;

    if (fighter.isHitstun > 0) fighter.isHitstun--;
    if (fighter.isBlockstun > 0) fighter.isBlockstun--;
    if (fighter.comboTimer > 0) {
      fighter.comboTimer--;
      if (fighter.comboTimer <= 0) fighter.comboCount = 0;
    }

    if (fighter.attack) {
      fighter.attack.frame++;
      var total = fighter.attack.move.startup + fighter.attack.move.active + fighter.attack.move.recovery;
      if (fighter.attack.frame >= total) {
        if (!fighter.attack.hasHit) {
          fighter.meter = Math.min(cfg.maxMeter, fighter.meter + fighter.attack.move.meterGain);
        }
        fighter.attack = null;
      }
    }

    fighter.x += fighter.vx * dt;
    fighter.vx *= cfg.friction;

    if (fighter.y < 0 || fighter.vy < 0) {
      fighter.vy += cfg.gravity * dt;
      fighter.y += fighter.vy * dt;
      if (fighter.y >= 0) {
        fighter.y = 0;
        fighter.vy = 0;
      }
    }

    if (fighter.isBlocking) {
      fighter.vx *= 0.7;
    }
  }

  function resolveAttacks(attacker, defender, tick) {
    if (!attacker.attack || attacker.attack.hasHit) return null;
    var move = attacker.attack.move;
    var frame = attacker.attack.frame;
    if (frame < move.startup || frame >= move.startup + move.active) return null;

    var reach = attacker.x + attacker.facing * (move.range + attacker.width / 2);
    var hit = lineIntersectsFighter(reach, defender);
    // Also allow hitting any point along the attack line segment between the
    // attacker and the reach point, so attacks connect at close range.
    if (!hit) {
      var start = attacker.x;
      var samples = 4;
      for (var s = 1; s <= samples; s++) {
        var t = s / (samples + 1);
        var sx = start + (reach - start) * t;
        if (lineIntersectsFighter(sx, defender)) {
          hit = true;
          break;
        }
      }
    }
    if (!hit) return null;

    attacker.attack.hasHit = true;

    var eventBase = {
      type: "hit",
      tick: tick,
      attacker: attacker.id,
      defender: defender.id,
      moveId: move.id,
      moveKind: move.kind,
    };

    if (defender.isBlocking) {
      var chip = Math.round(move.damage * VK.config.combat.blockDamageFactor);
      var kb = move.knockback * VK.config.combat.blockKnockbackFactor;
      defender.health = clamp(defender.health - chip, 0, maxHealth());
      defender.vx = defender.facing * kb * 5;
      defender.isBlockstun = framesFromSeconds(VK.config.combat.blockStun);
      attacker.meter = clamp(attacker.meter + move.meterGain, 0, maxMeter());
      attacker.vx = -attacker.facing * VK.config.combat.pushbackOnBlock * 5;
      return Object.assign(eventBase, {
        type: "blocked",
        damage: chip,
        knockback: kb,
        message: defender.name + " blocks " + attacker.name + "'s " + move.name + ".",
      });
    }

    // Counter detection: defender is within counterWindow of starting an attack.
    var countered = false;
    if (defender.attack) {
      var dFrame = defender.attack.frame;
      var dMove = defender.attack.move;
      var dStartup = dMove.startup;
      if (Math.abs(dFrame - dStartup) <= VK.config.combat.counterWindow) {
        countered = true;
      }
    }

    var damage = move.damage;
    var knockback = move.knockback;
    if (countered) {
      damage = Math.round(damage * 1.5);
      knockback = Math.round(knockback * 1.4);
    }

    defender.health = clamp(defender.health - damage, 0, maxHealth());
    defender.vx = defender.facing * knockback * 5;
    defender.isHitstun = framesFromSeconds(VK.config.combat.hitStun);
    defender.attack = null;

    attacker.comboCount++;
    attacker.comboTimer = VK.config.combat.comboWindow;
    attacker.meter = clamp(attacker.meter + VK.config.fighter.meterGainOnHit + move.meterGain, 0, maxMeter());

    var event = Object.assign(eventBase, {
      damage: damage,
      knockback: knockback,
      countered: countered,
      combo: attacker.comboCount > 1 ? attacker.comboCount : 0,
    });

    if (countered) {
      event.type = "counter";
      event.message = attacker.name + " counters " + defender.name + "'s " + dMove.name + " with " + move.name + "!";
    } else if (attacker.comboCount > 1) {
      event.type = "combo";
      event.message = attacker.name + " lands a " + attacker.comboCount + "-hit combo!";
    } else {
      event.message = attacker.name + " lands " + move.name + ".";
    }

    if (defender.health <= 0) {
      event.type = "ko";
      event.winner = attacker.id;
      event.message = attacker.name + " wins by KO!";
    }

    return event;
  }

  function lineIntersectsFighter(x, fighter) {
    var half = fighter.width / 2;
    var left = fighter.x - half;
    var right = fighter.x + half;
    return x >= left && x <= right;
  }


  function clampWalls(fighter, stageW) {
    var half = fighter.width / 2;
    if (fighter.x < half) {
      fighter.x = half;
      fighter.vx *= -VK.config.combat.wallBounce;
    } else if (fighter.x > stageW - half) {
      fighter.x = stageW - half;
      fighter.vx *= -VK.config.combat.wallBounce;
    }
  }

  function checkKO(player, enemy, tick) {
    if (player.health <= 0 || enemy.health <= 0) {
      var winner = player.health <= 0 ? enemy : player;
      return {
        type: "ko",
        tick: tick,
        winner: winner.id,
        message: winner.name + " wins by KO!",
      };
    }
    return null;
  }

  function checkTimeOut(time, player, enemy, tick) {
    if (time <= 0) {
      var winner = null;
      if (player.health > enemy.health) winner = player;
      else if (enemy.health > player.health) winner = enemy;
      return {
        type: "time_out",
        tick: tick,
        winner: winner ? winner.id : null,
        message: winner
          ? winner.name + " wins on points."
          : "Time's up — draw!",
      };
    }
    return null;
  }

  function maxHealth() { return VK.config.fighter.maxHealth; }
  function maxMeter() { return VK.config.fighter.maxMeter; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function framesFromSeconds(s) { return Math.max(1, Math.round(s / VK.config.combat.fixedStep)); }

  VK.combat = {
    makeFighter: makeFighter,
    moveIdForInput: moveIdForInput,
    getMoveById: getMoveById,
    canAct: canAct,
    canBlock: canBlock,
    startAttack: startAttack,
    setBlocking: setBlocking,
    updateFighter: updateFighter,
    resolveAttacks: resolveAttacks,
    clampWalls: clampWalls,
    checkKO: checkKO,
    checkTimeOut: checkTimeOut,
    clamp: clamp,
    framesFromSeconds: framesFromSeconds,
  };
})(window.VK);
