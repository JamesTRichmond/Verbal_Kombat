/*
 * input.js — translate keyboard into game intent.
 *
 *   1–4     throw the corresponding argument
 *   F       rebut the enemy's incoming argument (defense/riposte)
 *   Space   start / rematch
 *
 * Input only signals intent through callbacks; it never touches state or the
 * canvas directly.
 */
(function (VK) {
  "use strict";

  // handlers: { onMove(index), onDefend(), onStart() }
  function attach(handlers) {
    function onKeyDown(e) {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handlers.onStart && handlers.onStart();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        handlers.onDefend && handlers.onDefend();
        return;
      }
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        handlers.onMove && handlers.onMove(n - 1); // 1-based key -> 0-based index
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return function detach() {
      window.removeEventListener("keydown", onKeyDown);
    };
  }

  VK.input = { attach: attach };
})(window.VK);
