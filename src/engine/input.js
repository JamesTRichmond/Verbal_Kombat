/*
 * input.js — translate keyboard into game intent.
 *
 * Keys 1–4 throw the corresponding argument move. Space starts or resets a
 * match. Input only signals intent through callbacks; it never touches state
 * or the canvas directly.
 *
 * The listener ignores events that originate from interactive controls so
 * the same keys can be used elsewhere in the flow UI (for example, Space
 * activating a button) without accidentally throwing a move.
 */
(function (VK) {
  "use strict";

  function isInteractiveTarget(target) {
    if (!target) return false;
    var tag = target.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      tag === "BUTTON" ||
      (tag === "A" && target.href)
    );
  }

  // handlers: { onMove(index), onStart() }
  // Returns a detach function that removes the global keydown listener.
  function attach(handlers) {
    function onKeyDown(e) {
      if (isInteractiveTarget(e.target)) return;

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
