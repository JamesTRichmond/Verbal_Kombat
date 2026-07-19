/*
 * state.js — the game's data model and the update tick.
 *
 * Holds fighters, the loaded move list, match phase, and the match ledger.
 * `update(dt)` advances time-based systems on a fixed timestep (decision D11):
 * composure regen and the starter enemy AI. Rendering reads this; it never
 * writes here.
 */
(function (VK) {
  "use strict";

  var FIXED_DT = 1 / 60; // seconds per simulation tick

  function makeFighter(id, name, side) {
    var f = VK.config.fighter;
    return {
      id: id,
      name: name,
      side: side, // "left" | "right"
      health: f.maxHealth,
      composure: f.maxComposure,
    };
  }

  function createState(moves) {
    var seed = VK.rng.normalizeSeed();
    return {
      moves: moves,                 // array of fallacy/argument entries
      phase: "ready",               // "ready" | "fighting" | "ko"
      winner: null,
      fighters: {
        player: makeFighter("player", "You", "left"),
        enemy: makeFighter("enemy", "The Sophist", "right"),
      },
      rng: VK.rng.create(seed),
      aiTimer: 0,
      tick: 0,
      accumulator: 0,
      ledger: VK.ledger.create({ seed: seed }),
      log: [],                      // recent combat events (most recent last)
    };
  }

  function start(state) {
    var fresh = createState(state.moves);
    fresh.phase = "fighting";
    fresh.aiTimer = nextAiDelay(fresh);
    return fresh;
  }

  // Advance time-based systems by dt seconds using a fixed timestep accumulator.
  function update(state, dt) {
    if (state.phase !== "fighting") return;

    state.accumulator += dt;
    while (state.accumulator >= FIXED_DT) {
      step(state, FIXED_DT);
      state.accumulator -= FIXED_DT;
      state.tick += 1;
    }
  }

  function step(state, dt) {
    var maxC = VK.config.fighter.maxComposure;
    var regen = VK.config.fighter.composureRegen * dt;
    eachFighter(state, function (f) {
      f.composure = VK.combat.clamp(f.composure + regen, 0, maxC);
    });

    // Starter enemy AI: throws a random argument on a timer.
    state.aiTimer -= dt;
    if (state.aiTimer <= 0) {
      throwMove(state, "enemy", "player", randomMove(state));
      state.aiTimer = nextAiDelay(state);
    }

    checkKO(state);
  }

  // Player-facing helper: throw the move at the given index (0-based).
  function playerMove(state, index) {
    if (state.phase !== "fighting") return;
    var move = state.moves[index];
    if (move) throwMove(state, "player", "enemy", move);
  }

  function throwMove(state, attackerId, defenderId, move) {
    if (state.phase !== "fighting" || !move) return;
    var event = VK.combat.resolveMove(
      state.fighters[attackerId],
      state.fighters[defenderId],
      move,
      state.tick
    );
    pushLog(state, event);
    VK.ledger.append(state.ledger, event);
    checkKO(state);
  }

  function checkKO(state) {
    if (state.phase === "ko") return;
    var p = state.fighters.player;
    var e = state.fighters.enemy;
    if (p.health <= 0 || e.health <= 0) {
      state.phase = "ko";
      state.winner = p.health <= 0 ? e : p;
      var koEvent = {
        type: "ko",
        winner: state.winner.id,
        timestamp: state.tick,
        message: state.winner.name + " wins the argument.",
      };
      pushLog(state, koEvent);
      VK.ledger.append(state.ledger, koEvent);
    }
  }

  function pushLog(state, event) {
    state.log.push(event);
    if (state.log.length > 5) state.log.shift();
  }

  function randomMove(state) {
    return state.rng.pick("combat", state.moves);
  }

  function nextAiDelay(state) {
    var ai = VK.config.ai;
    // Range is in ticks; convert back to seconds.
    return state.rng.range("ai", Math.round(ai.minDelay / FIXED_DT), Math.round(ai.maxDelay / FIXED_DT)) * FIXED_DT;
  }

  function eachFighter(state, fn) {
    fn(state.fighters.player);
    fn(state.fighters.enemy);
  }

  VK.state = {
    create: createState,
    start: start,
    update: update,
    playerMove: playerMove,
  };
})(window.VK);
