/*
 * dataLoader.js — loads the fallacy/argument content.
 *
 * Tries to fetch data/fallacies.json. If that fails (e.g. Chrome blocks
 * fetch on file://), we fall back to a small built-in set so the game still
 * runs when index.html is opened directly. The JSON file remains the source
 * of truth; the fallback is only enough to keep the loop alive.
 */
(function (VK) {
  "use strict";

  var FALLBACK = {
    version: 1,
    fallacies: [
      {
        id: "straw_man",
        name: "Straw Man",
        description: "Misrepresenting an opponent's position.",
        example: "So you're saying we should let chaos reign?",
        counter: "I never claimed that.",
        damage: 6,
        risk: 5,
      },
      {
        id: "ad_hominem",
        name: "Ad Hominem",
        description: "Attacking the person, not the argument.",
        example: "You'd believe anything.",
        counter: "Address the claim, not me.",
        damage: 7,
        risk: 7,
      },
    ],
  };

  // Returns a Promise resolving to an array of validated fallacy entries.
  VK.loadData = function loadData() {
    return fetch(VK.config.dataUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        return normalize(json, "data/fallacies.json");
      })
      .catch(function (err) {
        console.warn(
          "[VK] Could not load " +
            VK.config.dataUrl +
            " (" +
            err.message +
            "). Using built-in demo set. " +
            "Serve locally (python3 -m http.server) for the full file."
        );
        return normalize(FALLBACK, "built-in fallback");
      });
  };

  // Drop malformed entries so the engine can trust what it gets.
  function normalize(json, source) {
    var list = (json && json.fallacies) || [];
    var clean = list.filter(function (f) {
      return (
        f &&
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        typeof f.damage === "number" &&
        typeof f.risk === "number"
      );
    });
    if (clean.length === 0) {
      throw new Error("No valid fallacies in " + source);
    }
    return clean;
  }
})(window.VK);
