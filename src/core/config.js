/*
 * config.js — tunable constants in one place.
 *
 * Balance numbers here are first-pass placeholders. The design side
 * (see /docs/BALANCE.md, authored separately) will inform the real values;
 * keep gameplay tuning in this file, not scattered through the engine.
 */
(function (VK) {
  "use strict";

  VK.config = {
    stage: { width: 960, height: 540 },

    fighter: {
      maxHealth: 100,     // lose all of this and you're KO'd
      maxComposure: 100,  // spent to attack; regenerates slowly
      composureRegen: 10, // composure regained per second
    },

    combat: {
      // A successful argument deals `damage`. Its `risk` is how exposed you
      // are afterward: if the defender counters, they hit back for
      // risk * counterMultiplier.
      counterMultiplier: 1.4,
      counterRiskThreshold: 6,
      counterComposureThreshold: 45,
      // Composure cost to throw a move scales with its damage.
      composureCostPerDamage: 1.5,
    },

    ai: {
      // Seconds between enemy arguments (starter AI is on a simple timer).
      // Tuned so a passive first-time match ends well under 3 minutes.
      minDelay: 0.9,
      maxDelay: 1.8,
    },

    // Path to the authoritative content file. See data/README.md for schema.
    dataUrl: "data/fallacies.json",
  };
})(window.VK);
