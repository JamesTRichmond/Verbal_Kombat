/*
 * rng.js — deterministic, seeded pseudo-random number generator.
 *
 * All game randomness (AI timing, move selection, dialogue draws) derives
 * from the match seed so replays and e2e runs are identical.
 */
(function (VK) {
  "use strict";

  function cyrb128(str) {
    var h1 = 1779033703;
    var h2 = 3144134277;
    var h3 = 1013904242;
    var h4 = 2773480762;
    for (var i = 0; i < str.length; i++) {
      var k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [
      (h1 ^ h2 ^ h3 ^ h4) >>> 0,
      (h2 ^ h1) >>> 0,
      (h3 ^ h1) >>> 0,
      (h4 ^ h1) >>> 0,
    ];
  }

  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0;
      b >>>= 0;
      c >>>= 0;
      d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function create(seed) {
    var s = cyrb128(String(seed));
    var rand = sfc32(s[0], s[1], s[2], s[3]);
    return {
      random: rand,
      randomInt: function (min, max) {
        return Math.floor(rand() * (max - min + 1)) + min;
      },
    };
  }

  VK.rng = { create: create };
})(window.VK);
