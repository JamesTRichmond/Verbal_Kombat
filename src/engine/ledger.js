/*
 * ledger.js — the match ledger, the single source of truth for dialogue and
 * judging (decision D8).
 *
 * The ledger opens with a match-start header and appends typed, timestamped
 * combat events. All timestamps are simulation ticks, not wall-clock time, so
 * a ledger reproduces deterministically from a seed and input sequence (D11).
 */
(function (VK) {
  "use strict";

  function createHeader(options) {
    options = options || {};
    return {
      type: "match_start",
      tick: 0,
      seed: options.seed || "",
      version: options.version || 1,
      player: options.player || null,
      opponent: options.opponent || null,
      arena: options.arena || null,
      topic: options.topic || null,
    };
  }

  function createLedger(options) {
    var header = createHeader(options);
    return {
      header: header,
      events: [header],
    };
  }

  function pushEvent(ledger, event) {
    ledger.events.push(event);
    return event;
  }

  function lastEvent(ledger) {
    return ledger.events[ledger.events.length - 1];
  }

  VK.ledger = {
    create: createLedger,
    push: pushEvent,
    last: lastEvent,
  };
})(window.VK);
