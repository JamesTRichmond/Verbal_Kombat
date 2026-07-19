/*
 * main.js — boot sequence. Wires selection screens, data, canvas, input,
 * loop, and verdict together. This is the only file that reaches across
 * subsystems; everything else stays in its lane.
 */
(function (VK) {
  "use strict";

  var SCREEN = {
    TOPIC: "topic",
    FIGHTER: "fighter",
    LOCATION: "location",
    FIGHT: "fight",
    VERDICT: "verdict",
  };

  function boot() {
    var app = document.getElementById("app");
    var canvas = document.getElementById("stage");
    var controls = document.getElementById("controls");
    if (!app || !canvas) {
      console.error("[VK] #app or #stage not found.");
      return;
    }
    var ctx = canvas.getContext("2d");

    var loop = null;
    var inputDetach = null;
    var currentScreen = SCREEN.TOPIC;
    var selections = {};

    function goTo(screen) {
      currentScreen = screen;
      canvas.hidden = screen !== SCREEN.FIGHT;
      controls.hidden = screen !== SCREEN.FIGHT;
      if (screen === SCREEN.FIGHT) {
        app.classList.add("fight-active");
      } else {
        app.classList.remove("fight-active");
      }
    }

    function onGameOver() {
      if (loop) loop.stop();
      goTo(SCREEN.VERDICT);
      screens.showVerdict(current);
    }

    function startFight() {
      current = VK.state.create(moves, {
        seed: "r1-smoke-test",
        topic: selections.topic,
        playerFighter: selections.playerFighter,
        enemyFighter: selections.enemyFighter,
        location: selections.location,
      });
      if (selections.playerFighter) {
        current.fighters.player.name = selections.playerFighter.name;
      }
      if (selections.enemyFighter) {
        current.fighters.enemy.name = selections.enemyFighter.name;
      }
      current = VK.state.start(current);

      goTo(SCREEN.FIGHT);
      if (loop) loop.stop();
      loop = VK.gameLoop.create(ctx, function () { return current; });
      loop.start();

      // Watch for KO so we can swap to the verdict screen.
      var checkInterval = setInterval(function () {
        if (current.phase === "ko") {
          clearInterval(checkInterval);
          onGameOver();
        }
      }, 250);
    }

    function restart() {
      selections = {};
      goTo(SCREEN.TOPIC);
      screens.showTopic(setupData, selections);
    }

    var screens = VK.screens.create(app, {
      onTopicSelected: function () { goTo(SCREEN.FIGHTER); screens.showFighter(setupData, selections); },
      onFighterSelected: function () { goTo(SCREEN.LOCATION); screens.showLocation(setupData, selections); },
      onLocationSelected: startFight,
      onRestart: restart,
    });

    var current;
    var moves;
    var setupData;

    Promise.all([VK.loadData(), VK.setupData.load()]).then(function (results) {
      moves = results[0];
      setupData = results[1];
      current = VK.state.create(moves);

      inputDetach = VK.input.attach({
        onStart: function () {
          if (current && currentScreen === SCREEN.FIGHT && current.phase === "ko") {
            current = VK.state.start(current);
            if (loop) loop.stop();
            loop = VK.gameLoop.create(ctx, function () { return current; });
            loop.start();
          }
        },
        onMove: function (index) {
          if (currentScreen === SCREEN.FIGHT) {
            VK.state.playerMove(current, index);
          }
        },
        onConfirm: function () {
          // Handled by focused buttons; kept here for future keyboard-first shortcuts.
        },
        onBack: function () {
          if (currentScreen === SCREEN.FIGHTER) { goTo(SCREEN.TOPIC); screens.showTopic(setupData, selections); }
          else if (currentScreen === SCREEN.LOCATION) { goTo(SCREEN.FIGHTER); screens.showFighter(setupData, selections); }
        },
      });

      goTo(SCREEN.TOPIC);
      screens.showTopic(setupData, selections);

      console.log("[VK] Ready — " + moves.length + " arguments loaded.");
    }).catch(function (err) {
      console.error("[VK] Boot failed:", err);
      app.textContent = "Failed to load game data. See console.";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.VK);
