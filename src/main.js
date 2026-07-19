/*
 * main.js — Release 1 entry point.
 *
 * Wires the screen-flow state machine to its DOM controller. The canvas
 * combat loop is started only when the player reaches the fight screen and
 * stopped when they leave, keeping the fight lifecycle separate from flow
 * navigation.
 */
(function (VK) {
  "use strict";

  function boot() {
    var root = document.getElementById("flow-app");
    if (!root) {
      console.error("[VK] #flow-app container not found.");
      return;
    }

    var current = VK.flow.create();

    var ui = VK.flowUi.create({
      root: root,
      getFlow: function () { return current; },
      onChange: function (next) {
        current = next;
        ui.render(current);
      },
      onStartFight: function () { VK.game.start(); },
      onStopFight: function () { VK.game.stop(); },
    });

    ui.render(current);
    console.log("[VK] Flow ready — start navigating.");

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.VK);
