/*
 * ledger.js — the match ledger, the single source of truth (D8).
 *
 * The ledger opens with a match-start header carrying everything needed to
 * replay the match: seed, fighters, arena, topic, and rules version. Every
 * combat event is appended as a typed, timestamped record. Judges and the
 * dialogue engine read only the ledger.
 */
(function (VK) {
  "use strict";

  function createHeader(options) {
    options = options || {};
    return {
      type: "match-start",
      version: options.version || 1,
      seed: options.seed,
      timestamp: 0,
      player: options.player || { id: "player", name: "You", side: "left" },
      enemy: options.enemy || { id: "enemy", name: "The Sophist", side: "right" },
      arena: options.arena || "Forum",
      topic: options.topic || { category: "General", question: "Should pineapple belong on pizza?" },
      rules: options.rules || {},
    };
  }

  function createLedger(options) {
    return {
      header: createHeader(options),
      events: [],
    };
  }

  function append(ledger, event) {
    if (!ledger || !event) return;
    ledger.events.push(event);
  }

  function lastEvent(ledger) {
    if (!ledger || ledger.events.length === 0) return null;
    return ledger.events[ledger.events.length - 1];
  }

  // A pure helper for rendering: format a simulation tick as mm:ss.cs.
  function formatTime(ticks) {
    var totalMs = (ticks || 0) * (VK.config.time && VK.config.time.tickMs ? VK.config.time.tickMs : 16);
    var minutes = Math.floor(totalMs / 60000);
    var seconds = Math.floor((totalMs % 60000) / 1000);
    var cs = Math.floor((totalMs % 1000) / 10);
    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0") +
      "." +
      String(cs).padStart(2, "0")
    );
  }

  VK.ledger = {
    createHeader: createHeader,
    create: createLedger,
    append: append,
    lastEvent: lastEvent,
    formatTime: formatTime,
  };
})(window.VK);
