/*
 * state.js — the game's data model and the update tick.
 *
 * Holds fighters, the loaded move list, match phase, round tally, the pending
 * enemy telegraph (riposte window), and the combat log. `update(dt)` advances
 * all time-based systems: composure regen, the enemy AI, the riposte timer,
 * and the between-rounds breather. Rendering reads this; it never writes here.
 *
 * Phases: "ready" -> "fighting" <-> "roundover" -> "matchover"
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
      phase: "ready",               // see header
      winner: null,                 // fighter who won the match
      fighters: {
        player: makeFighter("player", "You", "left"),
        enemy: makeFighter("enemy", "The Sophist", "right"),
      },
      rounds: { player: 0, enemy: 0 },
      roundsToWin: VK.config.rounds.roundsToWin,
      roundTimer: 0,                // counts down the between-rounds breather
      riposte: null,                // pending enemy attack the player can rebut
      aiTimer: nextAiDelay(),
      movePage: 0,                  // which page of the roster the keys map to
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
    // Between-rounds breather.
    if (state.phase === "roundover") {
      state.roundTimer -= dt;
      if (state.roundTimer <= 0) nextRound(state);
      return;
    }
    if (state.phase !== "fighting") return;

    regenComposure(state, dt);

    // A telegraphed enemy attack is on the clock — nothing else starts until
    // it resolves (player rebuts it, or the window lapses and it lands).
    if (state.riposte) {
      state.riposte.timeLeft -= dt;
      if (state.riposte.timeLeft <= 0) {
        landTelegraph(state, /* defended */ false);
      }
      return;
    }

    // Enemy winds up a new argument on a timer.
    state.aiTimer -= dt;
    if (state.aiTimer <= 0) {
      openEnemyAttack(state);
      state.aiTimer = nextAiDelay();
    }
  }

  // Player throws the argument in the given slot (0-based) on the current page.
  function playerMove(state, slot) {
    if (state.phase !== "fighting") return;
    if (slot < 0 || slot >= VK.config.moves.pageSize) return; // not a live slot
    var move = state.moves[state.movePage * VK.config.moves.pageSize + slot];
    if (!move) return; // empty slot on the last page
    var event = VK.combat.resolveMove(state.fighters.player, state.fighters.enemy, move);
    pushLog(state, event);
    checkKO(state);
  }

  // How many pages the roster spans at the configured page size.
  function pageCount(state) {
    return Math.max(1, Math.ceil(state.moves.length / VK.config.moves.pageSize));
  }

  // Cycle the visible page of arguments (wraps). dir is -1 or +1.
  function changePage(state, dir) {
    var n = pageCount(state);
    state.movePage = ((state.movePage + dir) % n + n) % n;
  }

  // Player calls out the incoming argument. Only lands if a telegraph is open.
  function playerDefend(state) {
    if (state.phase !== "fighting" || !state.riposte) return;
    landTelegraph(state, /* defended */ true);
  }

  // Resolve the pending enemy telegraph, whether rebutted or not.
  function landTelegraph(state, defended) {
    var r = state.riposte;
    state.riposte = null;
    var event = VK.combat.resolveTelegraphed(
      state.fighters[r.attackerId],
      state.fighters[r.defenderId],
      r.move,
      defended
    );
    pushLog(state, event);
    checkKO(state);
  }

  function openEnemyAttack(state) {
    var enemy = state.fighters.enemy;
    var move = affordableMove(state, enemy);
    if (!move) return; // too winded to argue this beat
    state.riposte = {
      attackerId: "enemy",
      defenderId: "player",
      move: move,
      timeLeft: VK.config.riposte.windowSeconds,
      windowSeconds: VK.config.riposte.windowSeconds,
    };
    pushLog(state, {
      type: "telegraph",
      message: enemy.name + ' winds up: "' + (move.example || move.name) + '"',
    });
  }

  function checkKO(state) {
    if (state.phase !== "fighting") return;
    var p = state.fighters.player;
    var e = state.fighters.enemy;
    if (p.health > 0 && e.health > 0) return;

    var roundWinner = p.health <= 0 ? e : p;
    state.rounds[roundWinner.id] += 1;
    state.riposte = null;
    pushLog(state, { type: "round", message: roundWinner.name + " takes the round." });

    if (state.rounds[roundWinner.id] >= state.roundsToWin) {
      state.phase = "matchover";
      state.winner = roundWinner;
      pushLog(state, { type: "match", message: roundWinner.name + " wins the match!" });
    } else {
      state.phase = "roundover";
      state.roundTimer = VK.config.rounds.roundInterval;
    }
  }

  function nextRound(state) {
    var f = VK.config.fighter;
    ["player", "enemy"].forEach(function (id) {
      state.fighters[id].health = f.maxHealth;
      state.fighters[id].composure = f.maxComposure;
    });
    state.riposte = null;
    state.aiTimer = nextAiDelay();
    state.phase = "fighting";
  }

  function regenComposure(state, dt) {
    var maxC = VK.config.fighter.maxComposure;
    var regen = VK.config.fighter.composureRegen * dt;
    eachFighter(state, function (fighter) {
      fighter.composure = VK.combat.clamp(fighter.composure + regen, 0, maxC);
    });
  }

  // A random move the fighter currently has the composure to throw.
  function affordableMove(state, fighter) {
    var options = state.moves.filter(function (m) {
      return fighter.composure >= VK.combat.moveCost(m);
    });
    if (!options.length) return null;
    return options[Math.floor(Math.random() * options.length)];
  }

  function pushLog(state, event) {
    state.log.push(event);
    if (state.log.length > 6) state.log.shift();
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
    playerDefend: playerDefend,
    changePage: changePage,
    pageCount: pageCount,
  };
})(window.VK);
