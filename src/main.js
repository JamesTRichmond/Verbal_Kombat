/*
 * main.js — boot sequence. Wires data + canvas + input + loop together.
 *
 * This is the only file that reaches across subsystems; everything else stays
 * in its lane. Load content, show the fighter selection screen, then build
 * state, attach input, and start the loop.
 */
(function (VK) {
  "use strict";

  function boot() {
    var canvas = document.getElementById("stage");
    if (!canvas) {
      console.error("[VK] #stage canvas not found.");
      return;
    }
    var ctx = canvas.getContext("2d");

    Promise.all([
      VK.loadData(),
      VK.loadFighters(),
    ]).then(function (results) {
      var moves = results[0];
      var fighters = results[1];

      var selectScreen = VK.fighterSelect.create(fighters, function (
        playerFighter,
        enemyFighter
      ) {
        selectScreen.hide();
        startMatch(ctx, moves, playerFighter, enemyFighter);
      });

      selectScreen.show();
      console.log("[VK] " + moves.length + " arguments and " + fighters.length + " fighters loaded.");
    }).catch(function (err) {
      console.error("[VK] Boot failed:", err);
    });
  }

  function startMatch(ctx, moves, playerFighter, enemyFighter) {
    // Single mutable state reference the loop reads and input replaces.
    var current = VK.state.create(moves, playerFighter, enemyFighter);
    var getState = function () { return current; };

    VK.input.attach({
      onStart: function () { current = VK.state.start(current); },
      onMove: function (index) { VK.state.playerMove(current, index); },
    });

    var loop = VK.gameLoop.create(ctx, getState);
    loop.start();

    console.log("[VK] Ready — press Space.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.VK);
