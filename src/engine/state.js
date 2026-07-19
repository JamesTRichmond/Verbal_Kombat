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

  function createState(moves, location) {
    location = location || defaultLocation();
    return {
      moves: moves,                 // array of fallacy/argument entries
      location: location,           // selected arena
      phase: "ready",               // "ready" | "fighting" | "ko"
      winner: null,
      fighters: {
        player: makeFighter("player", "You", "left"),
        enemy: makeFighter("enemy", "The Sophist", "right"),
      },
      aiTimer: nextAiDelay(),
      log: [],                      // recent combat events (most recent last)
      ledger: [                     // full match record for judging / replay
        makeHeaderRecord(moves, location)
      ],
      arenaEvent: resetArenaEvent(location),
    };
  }

  function start(state) {
    var fresh = createState(state.moves, state.location);
    fresh.phase = "fighting";
    return fresh;
  }

  function defaultLocation() {
    return {
      id: "forum",
      name: "The Forum",
      palette: { skyTop: "#2b1f3a", skyBottom: "#4a3b5c", floor: "#3d324a", accent: "#e4b04a" },
      event: { id: "forum_echo", name: "Echo", interval: 8, effect: { type: "dialogueWeightBoost", multiplier: 2, duration: 1 } },
    };
  }

  function makeHeaderRecord(moves, location) {
    return {
      type: "matchStart",
      timestamp: 0,
      location: { id: location.id, name: location.name },
      moves: moves.length,
      version: 1,
    };
  }

  function resetArenaEvent(location) {
    return {
      timer: location.event ? location.event.interval : 0,
      pending: false,
      effect: location.event ? location.event.effect : null,
    };
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

    tickArenaEvent(state, dt);
    checkKO(state);
  }

  function tickArenaEvent(state, dt) {
    var ev = state.arenaEvent;
    if (!ev || !ev.effect) return;
    if (ev.pending) return;
    ev.timer -= dt;
    if (ev.timer <= 0) {
      ev.pending = true;
      pushLog(state, {
        type: "arenaEvent",
        eventId: state.location.event.id,
        name: state.location.event.name,
        message: state.location.name + " rumbles: " + state.location.event.name + " is ready.",
      });
      pushLedger(state, {
        type: "arenaEventReady",
        timestamp: now(state),
        eventId: state.location.event.id,
        name: state.location.event.name,
      });
    }
  }

  // Player-facing helper: throw the move at the given index (0-based).
  function playerMove(state, index) {
    if (state.phase !== "fighting") return;
    var move = state.moves[index];
    if (move) throwMove(state, "player", "enemy", move);
  }

  function throwMove(state, attackerId, defenderId, move) {
    if (state.phase !== "fighting" || !move) return;
    var attacker = state.fighters[attackerId];
    var defender = state.fighters[defenderId];
    var event = VK.combat.resolveMove(attacker, defender, move);
    applyArenaEventOnHit(state, event, attacker);
    pushLog(state, event);
    pushLedger(state, eventToLedger(event, state));
    checkKO(state);
  }

  function applyArenaEventOnHit(state, event, attacker) {
    var ev = state.arenaEvent;
    if (!ev || !ev.pending || !ev.effect) return;
    if (event.type !== "hit") return;

    var effect = ev.effect;
    if (effect.type === "dialogueWeightBoost") {
      event.dialogueWeight = (event.dialogueWeight || 1) * effect.multiplier;
    } else if (effect.type === "composureRestore") {
      var maxC = VK.config.fighter.maxComposure;
      attacker.composure = VK.combat.clamp(attacker.composure + effect.amount, 0, maxC);
    }

    pushLog(state, {
      type: "arenaEvent",
      eventId: state.location.event.id,
      name: state.location.event.name,
      message: state.location.name + " " + state.location.event.name.toLowerCase() + " boosts " + attacker.name + "!",
    });
    pushLedger(state, {
      type: "arenaEventTriggered",
      timestamp: now(state),
      eventId: state.location.event.id,
      name: state.location.event.name,
      effect: effect.type,
      attacker: attacker.id,
    });

    ev.pending = false;
    ev.timer = state.location.event.interval;
  }

  function eventToLedger(event, state) {
    return {
      type: event.type,
      timestamp: now(state),
      attacker: event.attacker,
      defender: event.defender,
      move: event.move ? event.move.id : null,
      damage: event.damage,
      dialogueWeight: event.dialogueWeight || 1,
    };
  }

  function now(state) {
    return state.ledger ? state.ledger.length : 0;
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
      pushLedger(state, {
        type: "ko",
        timestamp: now(state),
        winner: state.winner.id,
      });
    }
  }

  function pushLog(state, event) {
    state.log.push(event);
    if (state.log.length > 5) state.log.shift();
  }

  function pushLedger(state, record) {
    state.ledger.push(record);
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
