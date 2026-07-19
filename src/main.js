/*
 * main.js — boot sequence. Wires data + screens + input + loop together.
 *
 * This is the only file that reaches across subsystems; everything else stays
 * in its lane. Load content, show the location picker, then build state and
 * start the fight loop once an arena is chosen.
 */
(function (VK) {
  "use strict";

  function boot() {
    var canvas = document.getElementById("stage");
    var selectScreen = document.getElementById("location-select");
    var fightHints = document.querySelectorAll(".fight-only");
    if (!canvas || !selectScreen) {
      console.error("[VK] Required DOM elements not found.");
      return;
    }
    var ctx = canvas.getContext("2d");

    Promise.all([VK.loadData(), VK.loadLocations()]).then(function (results) {
      var moves = results[0];
      var locations = results[1];

      var picker = VK.locationSelect.create(selectScreen, locations, function (location) {
        selectScreen.classList.add("hidden");
        canvas.classList.remove("hidden");
        fightHints.forEach(function (el) { el.classList.remove("hidden"); });

        var current = VK.state.create(moves, location);
        var getState = function () { return current; };

        VK.input.attach({
          onStart: function () { current = VK.state.start(current); },
          onMove: function (index) { VK.state.playerMove(current, index); },
        });

        var loop = VK.gameLoop.create(ctx, getState);
        loop.start();

        console.log("[VK] Ready — " + moves.length + " arguments, " + location.name + ". Press Space.");
      });

      picker.focus();
    }).catch(function (err) {
      console.error("[VK] Boot failed:", err);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.VK);
