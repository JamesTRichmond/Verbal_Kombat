/*
 * dataLoader.js — loads fallacy/argument and location content.
 *
 * Tries to fetch data/fallacies.json and data/locations.json. If that fails
 * (e.g. Chrome blocks fetch on file://), we fall back to small built-in sets
 * so the game still runs when index.html is opened directly. The JSON files
 * remain the sources of truth; the fallbacks are only enough to keep the
 * loop alive.
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
      {
        id: "slippery_slope",
        name: "Slippery Slope",
        description: "One step inevitably leads to catastrophe.",
        example: "Allow this once and everything unravels.",
        counter: "Each step needs its own evidence.",
        damage: 5,
        risk: 6,
      },
      {
        id: "false_dilemma",
        name: "False Dilemma",
        description: "Framing many options as only two choices.",
        example: "Agree with me or you're the enemy.",
        counter: "That's a false choice.",
        damage: 6,
        risk: 5,
      },
    ],
  };

  var LOCATIONS_FALLBACK = {
    version: 1,
    locations: [
      {
        id: "forum",
        name: "The Forum",
        description: "A marble amphitheater where every landed point reverberates.",
        palette: {
          skyTop: "#2b1f3a",
          skyBottom: "#4a3b5c",
          floor: "#3d324a",
          accent: "#e4b04a",
        },
        event: {
          id: "forum_echo",
          name: "Echo",
          description: "Doubles the dialogue weight of the next landed point.",
          trigger: "periodic",
          interval: 8,
          effect: { type: "dialogueWeightBoost", multiplier: 2, duration: 1 },
        },
      },
      {
        id: "studio",
        name: "The Studio",
        description: "A broadcast set where timing pressure favors the composed.",
        palette: {
          skyTop: "#0f1a25",
          skyBottom: "#1c2f3f",
          floor: "#141f2b",
          accent: "#4aa3e4",
        },
        event: {
          id: "studio_spotlight",
          name: "Spotlight",
          description: "Restores composure to the fighter who lands the next hit.",
          trigger: "periodic",
          interval: 10,
          effect: { type: "composureRestore", amount: 15, duration: 1 },
        },
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

  // Returns a Promise resolving to an array of validated location entries.
  VK.loadLocations = function loadLocations() {
    return fetch(VK.config.locationsUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        return normalizeLocations(json, "data/locations.json");
      })
      .catch(function (err) {
        console.warn(
          "[VK] Could not load " +
            VK.config.locationsUrl +
            " (" +
            err.message +
            "). Using built-in demo locations."
        );
        return normalizeLocations(LOCATIONS_FALLBACK, "built-in fallback");
      });
  };

  function normalizeLocations(json, source) {
    var list = (json && json.locations) || [];
    var clean = list.filter(function (loc) {
      return (
        loc &&
        typeof loc.id === "string" &&
        typeof loc.name === "string" &&
        loc.palette &&
        typeof loc.palette.skyTop === "string" &&
        typeof loc.palette.skyBottom === "string" &&
        typeof loc.palette.floor === "string" &&
        loc.event &&
        typeof loc.event.id === "string" &&
        typeof loc.event.interval === "number" &&
        loc.event.effect
      );
    });
    if (clean.length === 0) {
      throw new Error("No valid locations in " + source);
    }
    return clean;
  }

  // Drop malformed entries so the engine can trust what it gets.
  function normalize(json, source) {
    var list = (json && json.fallacies) || [];
    var clean = list.filter(function (f) {
      return (
        f &&
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        isValidScore(f.damage) &&
        isValidScore(f.risk)
      );
    });
    if (clean.length === 0) {
      throw new Error("No valid fallacies in " + source);
    }
    return clean;
  }

  function isValidScore(value) {
    return Number.isInteger(value) && value >= 1 && value <= 10;
  }
})(window.VK);
