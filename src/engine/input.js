/*
 * input.js — translate keyboard into game intent.
 *
 *   1–9         throw the argument in that slot on the current page
 *   Q / ←       previous page of arguments
 *   E / →       next page of arguments
 *   F           rebut the enemy's incoming argument (defense/riposte)
 *   Space       start / rematch
 *
 * Input only signals intent through callbacks; it never touches state or the
 * canvas directly. Which slots are valid (page size) is enforced downstream.
 */
(function (VK) {
  "use strict";

  // handlers: { onMove(slot), onPagePrev(), onPageNext(), onDefend(), onStart() }
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
      if (e.key === "q" || e.key === "Q" || e.key === "ArrowLeft") {
        handlers.onPagePrev && handlers.onPagePrev();
        return;
      }
      if (e.key === "e" || e.key === "E" || e.key === "ArrowRight") {
        handlers.onPageNext && handlers.onPageNext();
        return;
      }
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        handlers.onMove && handlers.onMove(n - 1); // 1-based key -> 0-based slot
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return function detach() {
      window.removeEventListener("keydown", onKeyDown);
    };
  }

  VK.input = { attach: attach };
})(window.VK);
