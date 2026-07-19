/*
 * state.js — the game's data model and the update tick.
 *
 * Holds fighters, the loaded move list, match phase, and the floating combat
 * log. `update(dt)` advances time-based systems (composure regen, the starter
 * enemy AI). Rendering reads this; it never writes here.
 *
 * Determinism: all randomness reads from state.rng, which is created from the
 * match seed in `start()`.
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

  function createState(moves, setup) {
    setup = setup || {};
    return {
      moves: moves,                 // array of fallacy/argument entries
      phase: "ready",               // "ready" | "fighting" | "ko"
      winner: null,
      seed: setup.seed || "default",
      topic: setup.topic || null,
      playerFighter: setup.playerFighter || null,
      enemyFighter: setup.enemyFighter || null,
      location: setup.location || null,
      fighters: {
        player: makeFighter("player", "You", "left"),
        enemy: makeFighter("enemy", "The Sophist", "right"),
      },
      rng: null,
      aiTimer: 0,
      log: [],                      // recent combat events (most recent last)
      ledger: [],                   // full ledger for judging (D8)
    };
  }

  function start(state) {
    var fresh = createState(state.moves, {
      seed: state.seed,
      topic: state.topic,
      playerFighter: state.playerFighter,
      enemyFighter: state.enemyFighter,
      location: state.location,
    });
    fresh.phase = "fighting";
    fresh.rng = VK.rng.create(fresh.seed);
    fresh.aiTimer = nextAiDelay(fresh);
    return fresh;
  }

  function setSetup(state, setup) {
    state.seed = setup.seed || state.seed || "default";
    if (setup.topic) state.topic = setup.topic;
    if (setup.playerFighter) state.playerFighter = setup.playerFighter;
    if (setup.enemyFighter) state.enemyFighter = setup.enemyFighter;
    if (setup.location) state.location = setup.location;
    if (setup.playerName) state.fighters.player.name = setup.playerName;
    if (setup.enemyName) state.fighters.enemy.name = setup.enemyName;
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
      var koEvent = { type: "ko", message: state.winner.name + " wins the argument." };
      pushLog(state, koEvent);
      state.verdict = VK.judges.scoreLedger(state.ledger);
    }
  }

  function pushLog(state, event) {
    var entry = Object.assign({ t: state.ledger.length }, event);
    state.log.push(entry);
    state.ledger.push(entry);
    if (state.log.length > 5) state.log.shift();
  }

  function randomMove(state) {
    if (!state.rng) return state.moves[0];
    return state.moves[Math.floor(state.rng.random() * state.moves.length)];
  }

  function nextAiDelay(state) {
    var ai = VK.config.ai;
    if (!state.rng) return ai.minDelay;
    return ai.minDelay + state.rng.random() * (ai.maxDelay - ai.minDelay);
  }

  function eachFighter(state, fn) {
    fn(state.fighters.player);
    fn(state.fighters.enemy);
  }

  VK.state = {
    create: createState,
    start: start,
    setSetup: setSetup,
    update: update,
    playerMove: playerMove,
  };
})(window.VK);
