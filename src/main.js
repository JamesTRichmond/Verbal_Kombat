/*
 * main.js — boot sequence. Wires content + flow + screens + canvas together.
 *
 * This is the only file that reaches across subsystems; everything else stays
 * in its lane. Load content, build the screen-flow machine, hand the fight
 * lifecycle (the placeholder canvas game) to the screens layer.
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

    Promise.all([VK.loadData(), VK.content.load()]).then(function (loaded) {
      var moves = loaded[0];
      var content = loaded[1];

      // Placeholder combat: the scaffold canvas game runs while the fight
      // screen is up. The real combat core (#13) replaces this start/stop
      // pair without touching the flow or the screens.
      var loop = null;
      var detachInput = null;
      var fightLifecycle = {
        start: function () {
          var current = VK.state.create(moves);
          var getState = function () { return current; };
          detachInput = VK.input.attach({
            onStart: function () { current = VK.state.start(current); },
            onMove: function (index) { VK.state.playerMove(current, index); },
          });
          loop = VK.gameLoop.create(ctx, getState);
          loop.start();
        },
        stop: function () {
          if (loop) { loop.stop(); loop = null; }
          if (detachInput) { detachInput(); detachInput = null; }
        },
      };

      var screens;
      var flow = VK.screenFlow.create({
        onChange: function (screen, setup) {
          if (screens) screens.render(screen, setup);
        },
      });

      screens = VK.screens.init({ flow: flow, content: content, fight: fightLifecycle });

      console.log(
        "[VK] Ready — " +
          content.topics.length + " categories, " +
          content.fighters.length + " fighters, " +
          content.locations.length + " venues."
      );
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
