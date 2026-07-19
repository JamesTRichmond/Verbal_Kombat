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

    // Mark the loop as "starting" immediately so repeated calls to start()
    // don't kick off multiple concurrent boots.
    loop = { stop: function () {} };
    var pendingLoop = loop;
    var pendingCtx = ctx;

    VK.loadData().then(function (moves) {
      // If stop() ran (or a later start() replaced ctx/loop), abort.
      if (loop !== pendingLoop || ctx !== pendingCtx) return;

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
      // If stop() ran, avoid logging a boot error for a screen the user left.
      if (ctx !== pendingCtx) return;
      if (loop === pendingLoop) loop = null;
      console.error("[VK] Fight boot failed:", err);
    });

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
