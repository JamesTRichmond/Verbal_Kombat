/*
 * main.js — boot sequence. Wires data + canvas + input + loop together.
 *
 * This is the only file that reaches across subsystems; everything else stays
 * in its lane. Load content, build state, attach input, start the loop.
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

    Promise.all([VK.loadFighters(), VK.loadMoves()]).then(function (results) {
      var fighters = results[0];
      var moves = results[1];

      var playerDef = fighters[0] || {
        id: "logician",
        name: "The Logician",
        palette: "#4aa3e4",
        stats: { speed: 5, power: 5, reach: 5 },
        behavior: {},
      };
      var enemyDef = fighters[1] || {
        id: "demagogue",
        name: "The Demagogue",
        palette: "#c8102e",
        stats: { speed: 3, power: 8, reach: 6 },
        behavior: {},
      };

      // Single mutable state reference the loop reads and input replaces.
      var current = VK.state.makeMatch("release-1-seed", playerDef, enemyDef, null);
      current.moves = moves;
      var getState = function () { return current; };

      VK.input.attach({
        onStart: function () { current = VK.state.start(current); current.moves = moves; },
        onIntent: function (intent) { VK.state.bufferInput(current, intent); },
      });

      var loop = VK.gameLoop.create(ctx, getState);
      loop.start();

      console.log("[VK] Ready — " + fighters.length + " fighters, " + moves.length + " moves loaded. Press Space.");
    }).catch(function (err) {
      console.error("[VK] Boot failed:", err);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.VK);
