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
      ticker: VK.ticker.create(
        VK.config.ticker.interval,
        VK.config.ticker.maxQueue
      ),
      // Simple combo detector: consecutive hits by the same fighter.
      combo: {
        attackerId: null,
        count: 0,
        windowSeconds: 2.0,
        decay: 0,
      },
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

    // Decay combo window.
    if (state.combo.count > 0) {
      state.combo.decay -= dt;
      if (state.combo.decay <= 0) {
        state.combo.count = 0;
        state.combo.attackerId = null;
      }
    }

    // Advance the dialogue ticker.
    VK.ticker.update(state.ticker, dt);

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

    // Light hit → jab; three hits by the same fighter within the window → combo.
    if (event.type === "hit") {
      if (state.combo.attackerId === attackerId) {
        state.combo.count += 1;
      } else {
        state.combo.attackerId = attackerId;
        state.combo.count = 1;
      }
      state.combo.decay = state.combo.windowSeconds;

      if (state.combo.count >= 3) {
        event = {
          type: "combo",
          attacker: state.fighters[attackerId],
          defender: state.fighters[defenderId],
          move: move,
          damage: event.damage,
        };
        state.combo.count = 0;
        state.combo.attackerId = null;
      }
    } else if (event.type !== "fizzle") {
      // Counters and whiffs break an opposing combo chain.
      state.combo.count = 0;
      state.combo.attackerId = null;
    }

    pushLog(state, event);
    enqueueDialogue(state, event);
    checkKO(state);
  }

  function enqueueDialogue(state, event) {
    var category = VK.dialogue.eventCategory(event);
    if (!category) return;

    var speakerId;
    if (event.type === "countered") {
      speakerId = event.defender.id;
    } else if (event.type === "ko") {
      speakerId = event.winner ? event.winner.id : null;
    } else {
      speakerId = event.attacker ? event.attacker.id : null;
    }
    if (!speakerId) return;

    var line = VK.dialogue.pickLine(event, speakerId, category);
    if (line) VK.ticker.enqueue(state.ticker, line);
  }

  function checkKO(state) {
    if (state.phase === "ko") return;
    var p = state.fighters.player;
    var e = state.fighters.enemy;
    if (p.health <= 0 || e.health <= 0) {
      state.phase = "ko";
      state.winner = p.health <= 0 ? e : p;
      var event = {
        type: "ko",
        winner: state.winner,
        message: state.winner.name + " wins the argument.",
      };
      pushLog(state, event);
      enqueueDialogue(state, event);
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
