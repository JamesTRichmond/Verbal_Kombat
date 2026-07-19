/*
 * state.js — the game's data model and the update tick.
 *
 * Holds fighters, the loaded move list, match phase, and the floating combat
 * log. `update(dt)` advances time-based systems (composure regen, the starter
 * enemy AI). Rendering reads this; it never writes here.
 */
(function (VK) {
  "use strict";

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
    return {
      moves: moves,                 // array of fallacy/argument entries
      phase: "ready",               // "ready" | "fighting" | "ko"
      winner: null,
      fighters: {
        player: makeFighter("player", "You", "left"),
        enemy: makeFighter("enemy", "The Sophist", "right"),
      },
      aiTimer: nextAiDelay(),
      log: [],                      // recent combat events (most recent last)
    };
  }

  function start(state) {
    var fresh = createState(state.moves);
    fresh.phase = "fighting";
    return fresh;
  }

  // Advance time-based systems by dt seconds.
  function update(state, dt) {
    if (state.phase !== "fighting") return;

    var maxC = VK.config.fighter.maxComposure;
    var regen = VK.config.fighter.composureRegen * dt;
    eachFighter(state, function (f) {
      f.composure = VK.combat.clamp(f.composure + regen, 0, maxC);
    });

    // Starter enemy AI: throws a random argument on a timer.
    state.aiTimer -= dt;
    if (state.aiTimer <= 0) {
      throwMove(state, "enemy", "player", randomMove(state));
      state.aiTimer = nextAiDelay();
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
      move
    );
    pushLog(state, event);
    checkKO(state);
  }

  function checkKO(state) {
    if (state.phase === "ko") return;
    var p = state.fighters.player;
    var e = state.fighters.enemy;
    if (p.health <= 0 || e.health <= 0) {
      state.phase = "ko";
      state.winner = p.health <= 0 ? e : p;
      pushLog(state, { type: "ko", message: state.winner.name + " wins the argument." });
    }
  }

  function pushLog(state, event) {
    state.log.push(event);
    if (state.log.length > 5) state.log.shift();
  }

  function randomMove(state) {
    return state.moves[Math.floor(Math.random() * state.moves.length)];
  }

  function nextAiDelay() {
    var ai = VK.config.ai;
    return ai.minDelay + Math.random() * (ai.maxDelay - ai.minDelay);
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
