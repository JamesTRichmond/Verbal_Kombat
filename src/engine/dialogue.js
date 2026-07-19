/*
 * dialogue.js — line selection from per-fighter, per-category template banks.
 *
 * Ledger events drive line choice. The function is pure: given an event, a
 * fighter, and the current topic category, it returns a line and the event
 * that earned it. Later, this is the drop-in point for an AI generator.
 */
(function (VK) {
  "use strict";

  // Placeholder banks. Each entry is a function so it can interpolate event
  // details without mutating shared strings. A real content file will replace
  // this object via dataLoader in a future issue.
  var BANKS = {
    player: {
      jab: [
        function (e) { return e.attacker.name + ": " + e.move.example; },
        function (e) { return e.attacker.name + " presses the point."; },
      ],
      combo: [
        function (e) { return e.attacker.name + " builds: " + e.move.example + ", then twists the blade."; },
        function (e) { return e.attacker.name + " links the claim to the consequence."; },
      ],
      special: [
        function (e) { return e.attacker.name + " uncorks the signature move — " + e.move.name + "."; },
      ],
      whiff: [
        function (e) { return e.attacker.name + " stumbles: " + e.move.example + " lands flat."; },
      ],
      counter: [
        function (e) { return e.defender.name + " counters: " + (e.move.counter || "Not so fast."); },
      ],
      ko: [
        function (e) { return e.winner.name + " has the final word."; },
      ],
    },
    enemy: {
      jab: [
        function (e) { return e.attacker.name + ": " + e.move.example; },
        function (e) { return e.attacker.name + " jabs back."; },
      ],
      combo: [
        function (e) { return e.attacker.name + " piles on: " + e.move.example + " and worse."; },
      ],
      special: [
        function (e) { return e.attacker.name + " unleashes a rhetorical flourish — " + e.move.name + "."; },
      ],
      whiff: [
        function (e) { return e.attacker.name + " overreaches and whiffs."; },
      ],
      counter: [
        function (e) { return e.defender.name + " rebuts: " + (e.move.counter || "Hardly."); },
      ],
      ko: [
        function (e) { return e.winner.name + " silences the room."; },
      ],
    },
  };

  // Map a ledger event to a category key. Jab and combo are both "hits" in the
  // combat log; the combo detector in state.js emits events with type "combo".
  function eventCategory(event) {
    if (event.type === "hit") return "jab";
    if (event.type === "combo") return "combo";
    if (event.type === "special") return "special";
    if (event.type === "fizzle" || event.type === "whiff") return "whiff";
    if (event.type === "countered") return "counter";
    if (event.type === "ko") return "ko";
    return null;
  }

  // Select a line. Pure function; deterministic when provided a seeded index.
  function pickLine(event, fighterId, category, pickIndex) {
    var categoryKey = category || eventCategory(event);
    if (!categoryKey) return null;
    var bank = BANKS[fighterId] && BANKS[fighterId][categoryKey];
    if (!bank || bank.length === 0) return null;
    var idx = typeof pickIndex === "number" ? (pickIndex % bank.length) : 0;
    var line = bank[idx](event);
    return { text: line, event: event, category: categoryKey };
  }

  VK.dialogue = { pickLine: pickLine, eventCategory: eventCategory };
})(window.VK);
