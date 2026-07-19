/*
 * screenFlow.js — the five-screen state machine:
 *
 *   argument -> fighter -> location -> fight -> verdict
 *
 * Pure state, no DOM. Each screen's selection is validated on entry and
 * accumulated into `setup`, which survives untouched to the verdict — the
 * verdict screen proves deep state by reading it. Back-navigation walks the
 * same path in reverse (leaving the fight abandons the round). `reset()`
 * returns to the argument screen with a clean setup.
 *
 * The UI layer (src/ui/screens.js) renders whatever screen this machine says
 * is current and calls the transition methods; it never mutates setup itself.
 */
(function (VK) {
  "use strict";

  var SCREENS = ["argument", "fighter", "location", "fight", "verdict"];

  function create(options) {
    var onChange = (options && options.onChange) || function () {};
    var screen = "argument";
    var setup = emptySetup();

    function emptySetup() {
      return { topic: null, fighter: null, opponent: null, location: null, result: null };
    }

    function goTo(next) {
      screen = next;
      onChange(screen, getSetup());
    }

    // Deep-copy so callers can never mutate flow state from outside.
    function getSetup() {
      return JSON.parse(JSON.stringify(setup));
    }

    function fail(message) {
      throw new Error("[screenFlow] " + message);
    }

    function requireScreen(expected, action) {
      if (screen !== expected) {
        fail(action + " is only valid on the " + expected + " screen (current: " + screen + ")");
      }
    }

    function isNonEmptyString(v) {
      return typeof v === "string" && v.length > 0;
    }

    return {
      SCREENS: SCREENS.slice(),

      getScreen: function () {
        return screen;
      },

      getSetup: getSetup,

      // argument -> fighter. Custom questions arrive already sanitized (the
      // UI runs VK.content.sanitizeCustomQuestion before calling this) and
      // are always bound to a category (decision D7).
      selectArgument: function (choice) {
        requireScreen("argument", "selectArgument");
        if (
          !choice ||
          !isNonEmptyString(choice.categoryId) ||
          !isNonEmptyString(choice.questionText) ||
          (!choice.isCustom && !isNonEmptyString(choice.questionId))
        ) {
          fail("selectArgument needs categoryId, questionText, and questionId (or isCustom)");
        }
        setup.topic = {
          categoryId: choice.categoryId,
          questionId: choice.isCustom ? "custom" : choice.questionId,
          questionText: choice.questionText,
          isCustom: !!choice.isCustom,
        };
        goTo("fighter");
      },

      // fighter -> location.
      selectFighter: function (choice) {
        requireScreen("fighter", "selectFighter");
        if (!choice || !isNonEmptyString(choice.fighterId) || !isNonEmptyString(choice.opponentId)) {
          fail("selectFighter needs fighterId and opponentId");
        }
        if (choice.fighterId === choice.opponentId) {
          fail("fighter and opponent must differ");
        }
        setup.fighter = choice.fighterId;
        setup.opponent = choice.opponentId;
        goTo("location");
      },

      // location -> fight.
      selectLocation: function (choice) {
        requireScreen("location", "selectLocation");
        if (!choice || !isNonEmptyString(choice.locationId)) {
          fail("selectLocation needs locationId");
        }
        setup.location = choice.locationId;
        goTo("fight");
      },

      // fight -> verdict. `result` is whatever the fight produced — for now a
      // placeholder outcome; once the combat core lands (#13) it becomes the
      // match ledger reference.
      finishFight: function (result) {
        requireScreen("fight", "finishFight");
        setup.result = result === undefined ? null : result;
        goTo("verdict");
      },

      // Walk backwards one screen. The selection made on the screen being
      // re-entered is cleared so re-selecting is the only way forward again;
      // earlier selections are kept. No back from argument (first screen) or
      // verdict (the round is over — use reset()).
      back: function () {
        if (screen === "fighter") {
          setup.topic = null;
          goTo("argument");
        } else if (screen === "location") {
          setup.fighter = null;
          setup.opponent = null;
          goTo("fighter");
        } else if (screen === "fight") {
          setup.location = null;
          goTo("location");
        } else {
          return false;
        }
        return true;
      },

      // Back to the start with a clean slate (verdict's "new argument", or
      // any screen's bail-out).
      reset: function () {
        setup = emptySetup();
        goTo("argument");
      },
    };
  }

  VK.screenFlow = { create: create, SCREENS: SCREENS.slice() };
})(window.VK);
