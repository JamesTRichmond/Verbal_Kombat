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
      width: 44,
      height: 96,
      maxHealth: 100,     // lose all of this and you're KO'd
      maxMeter: 100,      // special costs 100
      walkSpeed: 170,     // pixels per second
      backSpeed: 120,     // retreating is slightly slower
      gravity: 2000,      // pixels per second^2
      friction: 0.92,     // horizontal velocity decay per fixed step
      maxMeter: 100,
      meterGainOnHit: 12,
      meterGainOnWhiff: 2,
    },

    combat: {
      fixedStep: 1 / 60,           // seconds per simulation tick
      roundTime: 90,               // seconds
      hitStun: 0.22,               // seconds
      blockStun: 0.12,             // seconds
      blockDamageFactor: 0.25,
      blockKnockbackFactor: 0.35,
      counterWindow: 6,            // frames before/after an active hitbox
      comboWindow: 24,             // frames to chain a combo
      pushbackOnBlock: 40,
      wallBounce: 0.4,
    },

    ai: {
      reactionMin: 4,              // minimum frames between CPU decisions
      reactionMax: 12,
      safeDistance: 100,
    },

    // Paths to authoritative content files. See data/README.md for schemas.
    dataUrl: "data/fallacies.json",
    fightersUrl: "data/fighters.json",
    movesUrl: "data/moves.json",
  };
})(window.VK);
