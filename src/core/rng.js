/*
 * rng.js — deterministic seeded random number generator.
 *
 * Implements a mulberry32 variant seeded by a string. All randomness in the
 * game derives from here and is split into labeled streams so draws in one
 * subsystem never shift another's sequence (decision D11).
 */
(function (VK) {
  "use strict";

  function hashString(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function create(seed) {
    var nextState = hashString(String(seed));
    var state = nextState();

    var api = {
      seed: String(seed),
      next: next,
      range: range,
      pick: pick,
      stream: stream,
    };

    function next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function range(min, max) {
      return min + next() * (max - min);
    }

    function pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    }

    function stream(label) {
      return create(api.seed + "::stream::" + String(label));
    }

    return api;
  }

  VK.rng = { create: create };
})(window.VK);
