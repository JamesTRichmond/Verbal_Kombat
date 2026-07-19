/*
 * rng.js — deterministic seeded random number generator.
 *
 * All randomness in the match must come from a single seed (decision D11).
 * We use a small split-stream generator so combat, CPU behavior, and future
 * dialogue selection never shift each other's sequences.
 */
(function (VK) {
  "use strict";

  // Mulberry32: a simple, decent-quality 32-bit seeded PRNG.
  function mulberry32(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Hash a string into a 32-bit unsigned integer.
  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Derive a stable seed from an optional string/number seed. If nothing is
  // provided we still produce a deterministic value so tests stay reproducible.
  function normalizeSeed(seed) {
    if (seed === undefined || seed === null || seed === "") {
      return 123456789;
    }
    if (typeof seed === "number") {
      return (seed >>> 0) || 123456789;
    }
    return hashString(String(seed)) || 123456789;
  }

  // Create a new generator rooted at a seed. Streams are independent branches
  // so draws in one subsystem cannot shift another's sequence.
  function create(seed) {
    var base = normalizeSeed(seed);
    var streams = Object.create(null);

    function stream(name) {
      var n = String(name);
      if (!streams[n]) {
        // Mix the stream label into the base seed to create an independent root.
        streams[n] = mulberry32(normalizeSeed(base + "_" + n));
      }
      return streams[n];
    }

    function random(name) {
      return stream(name)();
    }

    function range(name, min, max) {
      return min + Math.floor(stream(name)() * (max - min + 1));
    }

    function pick(name, array) {
      if (!array || array.length === 0) return undefined;
      return array[range(name, 0, array.length - 1)];
    }

    return {
      seed: base,
      stream: stream,
      random: random,
      range: range,
      pick: pick,
    };
  }

  VK.rng = { create: create, normalizeSeed: normalizeSeed };
})(window.VK);
