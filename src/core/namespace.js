/*
 * namespace.js — the single global everything hangs off of.
 *
 * We avoid a build step and ES modules so the game runs by just opening
 * index.html. Every other file attaches its piece to this `VK` object.
 */
(function (global) {
  "use strict";
  global.VK = global.VK || {};
})(window);
