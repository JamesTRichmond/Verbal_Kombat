/*
 * flowUi.js — DOM controller for the five-screen Release 1 flow.
 *
 * Owns all reads and writes to the flow markup. It translates clicks and
 * keyboard input into calls on VK.flow and asks the host to update the flow
 * state via the onChange callback. Focus management is explicit so keyboard
 * users always know where they are.
 */
(function (VK) {
  "use strict";

  var PLACEHOLDERS = {
    fighters: {
      logician: { name: "The Logician", style: "Precise, counter-focused" },
      demagogue: { name: "The Demagogue", style: "Heavy swings, crowd-feeding" },
      empiricist: { name: "The Empiricist", style: "Jab pressure, evidence combos" },
      trickster: { name: "The Trickster", style: "Mobility, interrupts" },
    },
    locations: {
      forum: { name: "The Forum" },
      studio: { name: "The Studio" },
    },
  };

  function createFlowUi(options) {
    var root = options.root;
    var getFlow = options.getFlow;
    var onChange = options.onChange;
    var onStartFight = options.onStartFight;
    var onStopFight = options.onStopFight;

    var screens = {
      argument: root.querySelector("#screen-argument"),
      fighter: root.querySelector("#screen-fighter"),
      location: root.querySelector("#screen-location"),
      fight: root.querySelector("#screen-fight"),
      verdict: root.querySelector("#screen-verdict"),
    };

    wireArgumentScreen(screens.argument);
    wireFighterScreen(screens.fighter);
    wireLocationScreen(screens.location);
    wireFightScreen(screens.fight);
    wireVerdictScreen(screens.verdict);
    wireBackButtons(root);
    wireEscape();

    function wireArgumentScreen(el) {
      el.querySelectorAll("[data-category]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          onChange(VK.flow.selectTopic(getFlow(), btn.dataset.category, btn.dataset.question));
        });
      });

      var customInput = el.querySelector("#argument-custom");
      var customBtn = el.querySelector("#argument-custom-btn");
      customBtn.addEventListener("click", function () {
        var text = customInput.value.trim();
        if (!text) {
          customInput.focus();
          return;
        }
        onChange(VK.flow.selectTopic(getFlow(), "custom", text));
      });
      customInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          customBtn.click();
        }
      });
    }

    function wireFighterScreen(el) {
      el.querySelectorAll("[data-fighter]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          onChange(VK.flow.selectFighter(getFlow(), btn.dataset.fighter));
        });
      });
    }

    function wireLocationScreen(el) {
      el.querySelectorAll("[data-location]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          onChange(VK.flow.selectLocation(getFlow(), btn.dataset.location));
        });
      });
    }

    function wireFightScreen(el) {
      var endBtn = el.querySelector("#fight-end-btn");
      endBtn.addEventListener("click", function () {
        onChange(VK.flow.endFight(getFlow(), { winner: "player", summary: "placeholder" }));
      });
    }

    function wireVerdictScreen(el) {
      el.querySelector("#verdict-restart-btn").addEventListener("click", function () {
        onChange(VK.flow.reset(getFlow()));
      });
    }

    function wireBackButtons(root) {
      root.querySelectorAll(".back-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          onChange(VK.flow.goBack(getFlow()));
        });
      });
    }

    function wireEscape() {
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          var flow = getFlow();
          if (VK.flow.canGoBack(flow)) {
            e.preventDefault();
            onChange(VK.flow.goBack(flow));
          }
        }
      });
    }

    function render(flow) {
      Object.keys(screens).forEach(function (key) {
        screens[key].hidden = key !== flow.screen;
      });

      var active = screens[flow.screen];
      active.hidden = false;

      // Show or hide every back button based on whether back is legal.
      root.querySelectorAll(".back-button").forEach(function (btn) {
        btn.hidden = !VK.flow.canGoBack(flow);
      });

      if (flow.screen === VK.flow.SCREENS.FIGHT) {
        if (onStartFight) onStartFight();
      } else {
        if (onStopFight) onStopFight();
      }

      if (flow.screen === VK.flow.SCREENS.VERDICT) {
        renderVerdict(flow);
      }

      focusScreen(active);
    }

    function renderVerdict(flow) {
      var topicEl = screens.verdict.querySelector("#verdict-topic");
      var fighterEl = screens.verdict.querySelector("#verdict-fighter");
      var locationEl = screens.verdict.querySelector("#verdict-location");
      var resultEl = screens.verdict.querySelector("#verdict-result");

      if (flow.topic) {
        topicEl.textContent = flow.topic.questionText || "(custom)";
      } else {
        topicEl.textContent = "—";
      }

      var fighter = flow.playerFighterId && PLACEHOLDERS.fighters[flow.playerFighterId];
      fighterEl.textContent = fighter ? fighter.name : "—";

      var location = flow.locationId && PLACEHOLDERS.locations[flow.locationId];
      locationEl.textContent = location ? location.name : "—";

      if (flow.fightResult && flow.fightResult.winner) {
        resultEl.textContent = "Winner: " + flow.fightResult.winner;
      } else {
        resultEl.textContent = "—";
      }
    }

    function focusScreen(el) {
      var target = el.querySelector('h2[tabindex="-1"]');
      if (!target) {
        target = el.querySelector("button:not([hidden]):not([disabled]), input:not([disabled]), textarea:not([disabled])");
      }
      if (target && target.focus) target.focus();
    }

    return { render: render };
  }

  VK.flowUi = { create: createFlowUi };
})(window.VK);
