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
    var argumentScreen = document.getElementById("screen-argument");
    var fightScreen = document.getElementById("screen-fight");
    var argumentContainer = document.getElementById("argument-select");

    if (!argumentScreen || !fightScreen || !argumentContainer) {
      console.error("[VK] Required screen elements not found.");
      return;
    }

    Promise.all([VK.loadData(), VK.loadTopics()])
      .then(function (results) {
        var moves = results[0];
        var categories = results[1];

        var unmountSelect = VK.argumentSelect.mount(
          argumentContainer,
          categories,
          function onSelect(topic) {
            unmountSelect();
            argumentScreen.classList.remove("active");
            fightScreen.classList.add("active");

            // Single mutable state reference the loop reads and input replaces.
            var current = VK.state.create(moves, topic);
            var getState = function () { return current; };

            VK.input.attach({
              onStart: function () { current = VK.state.start(current); },
              onMove: function (index) { VK.state.playerMove(current, index); },
            });

            var loop = VK.gameLoop.create(ctx, getState);
            loop.start();

            console.log("[VK] Ready — " + moves.length + " arguments loaded. Press Space.");
          }
        );
      })
      .catch(function (err) {
        console.error("[VK] Boot failed:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.VK);
