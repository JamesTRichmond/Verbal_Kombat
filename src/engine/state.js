/*
 * state.js — the game's data model and fixed-timestep update tick.
 *
 * Holds fighters, the match ledger, round timer, and phase. Rendering reads
 * this; it never writes here. All updates are deterministic given a seed and
 * input sequence (decision D11).
 */
(function (VK) {
  "use strict";

  function makeMatch(seed, playerDef, enemyDef, arena) {
    var stageW = VK.config.stage.width;
    var rng = VK.rng.create(seed);
    return {
      phase: "ready",               // "ready" | "fighting" | "ended"
      winner: null,
      tick: 0,
      time: VK.config.combat.roundTime,
      rng: rng,
      streams: {
        combat: rng.stream("combat"),
        cpu: rng.stream("cpu"),
        dialogue: rng.stream("dialogue"),
      },
      fighters: {
        player: VK.combat.makeFighter(playerDef, "left", stageW * 0.28),
        enemy: VK.combat.makeFighter(enemyDef, "right", stageW * 0.72),
      },
      ledger: VK.ledger.create({
        seed: seed,
        player: playerDef,
        opponent: enemyDef,
        arena: arena,
      }),
      inputs: [],                   // buffered intents for the current tick
      cpu: {
        thinkTimer: 0,
        intent: null,
      },
    };
  }

  function start(match) {
    var fresh = makeMatch(match.ledger.header.seed, match.ledger.header.player, match.ledger.header.opponent, match.ledger.header.arena);
    fresh.phase = "fighting";
    return fresh;
  }

  // Push a player intent for the next fixed step. Called by input.
  function bufferInput(match, intent) {
    if (match.phase !== "fighting") return;
    match.inputs.push(intent);
  }

  // Advance one fixed timestep. Deterministic: same inputs, same result.
  function update(match) {
    if (match.phase !== "fighting") return;

    var cfg = VK.config.combat;
    var step = cfg.fixedStep;
    match.tick++;
    match.time = Math.max(0, match.time - step);

    var p = match.fighters.player;
    var e = match.fighters.enemy;

    applyInputs(match, p);
    applyCpu(match, e, p);

    VK.combat.updateFighter(p, step);
    VK.combat.updateFighter(e, step);

    // Resolve both attack directions; attacker advantage when simultaneous.
    var event = VK.combat.resolveAttacks(p, e, match.tick);
    if (event) pushLedger(match, event);
    event = VK.combat.resolveAttacks(e, p, match.tick);
    if (event) pushLedger(match, event);

    VK.combat.clampWalls(p, VK.config.stage.width);
    VK.combat.clampWalls(e, VK.config.stage.width);

    var ko = VK.combat.checkKO(p, e, match.tick);
    if (ko) {
      // Final hit already emitted a ko event; just end the match.
      if (match.ledger.events[match.ledger.events.length - 1].type !== "ko") {
        pushLedger(match, ko);
      }
      match.phase = "ended";
      var koEvent = match.ledger.events[match.ledger.events.length - 1];
      var winnerId = koEvent.winner || ko.winner;
      match.winner = winnerId === "player" || winnerId === p.id ? p : e;
      return;
    }

    var timeOut = VK.combat.checkTimeOut(match.time, p, e, match.tick);
    if (timeOut) {
      pushLedger(match, timeOut);
      match.phase = "ended";
      if (timeOut.winner) {
        match.winner = timeOut.winner === p.id || timeOut.winner === "player" ? p : e;
      }
      return;
    }

    // Clear per-tick input buffer.
    match.inputs.length = 0;
  }

  function applyInputs(match, fighter) {
    var moves = match.moves || [];
    for (var i = 0; i < match.inputs.length; i++) {
      var intent = match.inputs[i];
      if (intent.type === "move") {
        fighter.vx = (intent.direction === "left" ? -1 : 1) * VK.config.fighter.walkSpeed;
        fighter.facing = intent.direction === "left" ? -1 : 1;
      } else if (intent.type === "retreat") {
        fighter.vx = (intent.direction === "left" ? -1 : 1) * VK.config.fighter.backSpeed;
        fighter.facing = intent.direction === "right" ? -1 : 1;
      } else if (intent.type === "attack") {
        var id = VK.combat.moveIdForInput(intent.kind);
        if (id) VK.combat.startAttack(fighter, id, moves);
      } else if (intent.type === "block") {
        VK.combat.setBlocking(fighter, intent.active);
      }
    }
  }

  function applyCpu(match, cpu, player) {
    if (cpu.isHitstun > 0 || cpu.isBlockstun > 0) return;

    cpu.attack = cpu.attack; // preserve current attack animation
    if (cpu.attack) return;

    if (cpu.isBlocking) VK.combat.setBlocking(cpu, false);

    match.cpu.thinkTimer--;
    if (match.cpu.thinkTimer > 0) return;

    var behavior = cpu.behavior || {};
    var aggression = lookupAggression(behavior.aggression || [], match.time);
    var rng = match.streams.cpu;
    var dist = Math.abs(player.x - cpu.x);
    var facingPlayer = (player.x - cpu.x) * cpu.facing > 0;

    match.cpu.thinkTimer = Math.round(rng.range(VK.config.ai.reactionMin, VK.config.ai.reactionMax));

    if (!facingPlayer) {
      cpu.vx = (player.x > cpu.x ? 1 : -1) * VK.config.fighter.walkSpeed;
      cpu.facing = player.x > cpu.x ? 1 : -1;
      return;
    }

    var blockRoll = rng.next();
    var shouldBlock = blockRoll < (behavior.blockPreference || 0) && dist < (behavior.punishDistance || 90);
    if (shouldBlock) {
      VK.combat.setBlocking(cpu, true);
      return;
    }

    var punchRoll = rng.next();
    var inPunchRange = dist <= 100;
    var inPunishWindow = dist <= (behavior.punishDistance || 110) && player.attack && player.attack.frame >= player.attack.move.startup;

    if (inPunishWindow) {
      if (punchRoll < 0.75) {
        VK.combat.startAttack(cpu, VK.combat.moveIdForInput(rng.next() < 0.6 ? "light" : "heavy"), match.moves || []);
      }
      return;
    }

    if (inPunchRange && punchRoll < aggression) {
      var kind = "light";
      if (cpu.meter >= VK.config.fighter.maxMeter && rng.next() < 0.4) {
        kind = "special";
      } else if (rng.next() < 0.35) {
        kind = "heavy";
      }
      VK.combat.startAttack(cpu, VK.combat.moveIdForInput(kind), match.moves || []);
      return;
    }

    if (dist > (behavior.safeDistance || VK.config.ai.safeDistance)) {
      cpu.vx = (player.x > cpu.x ? 1 : -1) * VK.config.fighter.walkSpeed * (0.6 + rng.range(0, 0.4));
    } else if (dist < 50) {
      cpu.vx = (cpu.x > player.x ? 1 : -1) * VK.config.fighter.backSpeed * 0.7;
    }
  }

  function lookupAggression(curve, timeLeft) {
    var elapsed = VK.config.combat.roundTime - timeLeft;
    for (var i = 0; i < curve.length; i++) {
      if (elapsed < curve[i].until) return curve[i].value;
    }
    return 0.5;
  }

  function pushLedger(match, event) {
    VK.ledger.push(match.ledger, event);
  }

  VK.state = {
    makeMatch: makeMatch,
    start: start,
    update: update,
    bufferInput: bufferInput,
  };
})(window.VK);
