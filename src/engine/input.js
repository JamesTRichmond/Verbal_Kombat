/*
 * input.js — translate keyboard into game intent.
 *
 * Arrow keys / A-D move, J/K/L light/heavy/special, Space start/reset.
 * Input only signals intent through callbacks; it never touches state or the
 * canvas directly.
 */
(function (VK) {
  "use strict";

  // handlers: { onStart(), onIntent(intent) }
  function attach(handlers) {
    var held = {};

    function emit(intent) {
      handlers.onIntent && handlers.onIntent(intent);
    }

    function onKeyDown(e) {
      if (e.repeat) return;

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handlers.onStart && handlers.onStart();
        return;
      }

      var intent = null;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        held["left"] = true;
        intent = { type: "move", direction: "left" };
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        held["right"] = true;
        intent = { type: "move", direction: "right" };
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        intent = { type: "retreat", direction: "left" };
      } else if (e.key === "j" || e.key === "J") {
        intent = { type: "attack", kind: "light" };
      } else if (e.key === "k" || e.key === "K") {
        intent = { type: "attack", kind: "heavy" };
      } else if (e.key === "l" || e.key === "L") {
        intent = { type: "attack", kind: "special" };
      } else if (e.key === "b" || e.key === "B") {
        held["block"] = true;
        intent = { type: "block", active: true };
      }

      if (intent) {
        e.preventDefault();
        emit(intent);
      }
    }

    function onKeyUp(e) {
      if (e.key === "b" || e.key === "B") {
        held["block"] = false;
        emit({ type: "block", active: false });
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        held["left"] = false;
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        held["right"] = false;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return function detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }

  VK.input = { attach: attach };
})(window.VK);
