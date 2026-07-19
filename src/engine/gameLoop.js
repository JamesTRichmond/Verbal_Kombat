/*
 * gameLoop.js — the requestAnimationFrame heartbeat.
 *
 * Fixed responsibility: accumulate wall-clock time and step the simulation
 * by the fixed timestep from decision D11, then render. It owns no game
 * rules and no drawing.
 */
(function (VK) {
  "use strict";

  function create(ctx, getState) {
    var last = 0;
    var running = false;
    var rafId = null;
    var accumulator = 0;
    var step = VK.config.combat.fixedStep;

    function frame(now) {
      if (!running) return;
      var dt = last ? (now - last) / 1000 : 0;
      last = now;
      // Guard against huge dt after a tab is backgrounded.
      if (dt > 0.25) dt = 0.25;
      accumulator += dt;

      while (accumulator >= step) {
        VK.state.update(getState());
        accumulator -= step;
      }

      VK.renderer.draw(ctx, getState());
      rafId = requestAnimationFrame(frame);
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        last = 0;
        accumulator = 0;
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
