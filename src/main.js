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

    VK.loadData().then(function (moves) {
      // Single mutable state reference the loop reads and input replaces.
      var current = VK.state.create(moves);
      var getState = function () { return current; };

      VK.input.attach({
        onStart: function () {
          // Space while the verdict overlay is open triggers rematch.
          var overlay = document.getElementById("verdict-overlay");
          if (overlay && !overlay.hidden) {
            current = VK.state.start(current);
            return;
          }
          // Start or restart a match from any non-fighting phase.
          if (current.phase !== "fighting") {
            current = VK.state.start(current);
          }
        },
        onMove: function (index) { VK.state.playerMove(current, index); },
      });

      // Allow mouse/touch users to dismiss the verdict overlay too.
      var overlay = document.getElementById("verdict-overlay");
      if (overlay) {
        overlay.addEventListener("click", function (e) {
          if (e.target.id === "verdict-close" || e.target.closest(".verdict-dialog") === null) {
            current = VK.state.start(current);
          }
        });
      }

      var loop = VK.gameLoop.create(ctx, getState);
      loop.start();

      console.log("[VK] Ready — " + moves.length + " arguments loaded. Press Space.");
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
