/*
 * gameLoop.js — the requestAnimationFrame heartbeat.
 *
 * Fixed responsibility: compute delta time, call state.update(dt), then
 * renderer.draw(). It owns no game rules and no drawing — it just sequences
 * them. Uses performance.now() for the clock so timing is independent of
 * frame rate.
 */
(function (VK) {
  "use strict";

  function create(ctx, getState) {
    var last = 0;
    var running = false;
    var rafId = null;

    function frame(now) {
      if (!running) return;
      var dt = last ? (now - last) / 1000 : 0;
      last = now;
      // Guard against huge dt after a tab is backgrounded.
      if (dt > 0.1) dt = 0.1;

      VK.state.update(getState(), dt);
      VK.renderer.draw(ctx, getState());

      rafId = requestAnimationFrame(frame);
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        last = 0;
        rafId = requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
      },
    };
  }

  VK.gameLoop = { create: create };
})(window.VK);
