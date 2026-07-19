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
        onStart: function () { current = VK.state.start(current); },
        onMove: function (slot) { VK.state.playerMove(current, slot); },
        onDefend: function () { VK.state.playerDefend(current); },
        onPagePrev: function () { VK.state.changePage(current, -1); },
        onPageNext: function () { VK.state.changePage(current, +1); },
      });

      var loop = VK.gameLoop.create(ctx, getState);
      loop.start();

      console.log("[VK] Ready — " + moves.length + " arguments loaded. Press Space.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.VK);
