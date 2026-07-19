/*
 * game.js — lifecycle wrapper around the canvas combat loop.
 *
 * Separates starting/stopping the fight from the screen-flow UI so the flow
 * controller can boot the fight exactly when the player reaches the fight
 * screen and tear it down when they leave.
 */
(function (VK) {
  "use strict";

  var ctx = null;
  var loop = null;
  var detachInput = null;

  function start(canvas) {
    if (loop) return;
    if (!canvas) canvas = document.getElementById("stage");
    if (!canvas) {
      console.error("[VK] #stage canvas not found.");
      return;
    }
    ctx = canvas.getContext("2d");

    VK.loadData().then(function (moves) {
      var current = VK.state.create(moves);
      var getState = function () { return current; };

      detachInput = VK.input.attach({
        onStart: function () { current = VK.state.start(current); },
        onMove: function (index) { VK.state.playerMove(current, index); },
      });

      loop = VK.gameLoop.create(ctx, getState);
      loop.start();

      console.log("[VK] Fight ready — " + moves.length + " arguments loaded. Press Space.");
    }).catch(function (err) {
      console.error("[VK] Fight boot failed:", err);
    });
  }

  function stop() {
    if (loop) {
      loop.stop();
      loop = null;
    }
    if (detachInput) {
      detachInput();
      detachInput = null;
    }
    ctx = null;
  }

  VK.game = { start: start, stop: stop };
})(window.VK);
