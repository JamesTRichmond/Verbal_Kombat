/*
 * input.js — translate keyboard into game intent.
 *
 * Keys 1–4 throw the corresponding argument move. Space starts or resets a
 * match. Enter / Escape can be wired by callers for UI confirmation/back.
 * Input only signals intent through callbacks; it never touches state or the
 * canvas directly.
 */
(function (VK) {
  "use strict";

  // handlers: { onStart(), onMove(index), onConfirm(), onBack() }
  function attach(handlers) {
    function onKeyDown(e) {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handlers.onStart && handlers.onStart();
        return;
      }
      if (e.key === "Enter") {
        handlers.onConfirm && handlers.onConfirm();
        return;
      }
      if (e.key === "Escape") {
        handlers.onBack && handlers.onBack();
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
