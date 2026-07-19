/*
 * input.js — translate keyboard into game intent.
 *
 * Keys 1–4 throw the corresponding argument move. Space starts or resets a
 * match. Input only signals intent through callbacks; it never touches state
 * or the canvas directly.
 */
(function (VK) {
  "use strict";

  // handlers: { onMove(index), onStart() }
  function attach(handlers) {
    function isInteractive(el) {
      if (!el || !el.tagName) return false;
      var tag = el.tagName;
      return (
        tag === "BUTTON" ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "A" ||
        (el.getAttribute && el.getAttribute("role") === "button")
      );
    }

    function onKeyDown(e) {
      // Never swallow keys aimed at an interactive control — Space must still
      // activate a focused button (native buttons click on Space only if the
      // keydown default was not prevented).
      if (isInteractive(e.target)) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handlers.onStart && handlers.onStart();
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
