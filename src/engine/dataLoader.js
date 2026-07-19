/*
 * dataLoader.js — loads content data with a fetch-and-fallback pattern.
 *
 * Tries to fetch each data file from the paths configured in VK.config.dataUrls.
 * If a fetch fails (e.g. Chrome blocks fetch on file://), we fall back to a small
 * built-in demo set so the game still runs when index.html is opened directly.
 * The JSON files remain the source of truth; fallbacks are only enough to keep
 * the loop alive and are never shipped content.
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
    categories: [
      { id: "ethics", name: "Ethics", questions: ["Is it ever acceptable to tell a lie?"] },
      { id: "food", name: "Food", questions: ["Does pineapple belong on pizza?"] },
      { id: "work", name: "Work", questions: ["Should the workweek be shorter?"] },
      { id: "sports", name: "Sports", questions: ["Do video games qualify as art?"] },
    ],
    fighters: [
      {
        id: "logician",
        name: "The Logician",
        style: "Precise, counter-focused.",
        stats: { reach: 6, speed: 4, power: 5, defense: 6 },
        special: { name: "Q.E.D.", description: "Turns an opponent's risk into damage." },
        lineBankKeys: ["ethics"],
        cpu: {
          aggressionCurve: [{ hpThreshold: 100, pressure: 0.25 }],
          punishWindows: { whiff: { frames: 18, response: "counter" } },
          preferredRange: "mid",
          patience: 0.8,
        },
      },
    ],
    locations: [
      {
        id: "forum",
        name: "The Forum",
        description: "A marble arena.",
        palette: { skyTop: "#1a237e", skyBottom: "#3949ab", floor: "#e0e0e0", accent: "#ffd54f" },
        environmentalEvent: {
          id: "forum_echo",
          trigger: "onLightHit",
          cooldownSeconds: 20,
          effect: { type: "dialogueWeight", multiplier: 2, durationSeconds: 3 },
          announcement: "The Forum echoes your point.",
        },
      },
    ],
    lines: {
      logician: {
        version: 1,
        fighterId: "logician",
        categories: {
          ethics: {
            lightHit: ["That premise assumes facts not in evidence."],
            heavyHit: ["The argument collapses once the terms are defined."],
            counter: ["That is the non sequitur I was waiting for."],
            block: ["I will grant the premise, but not the leap."],
            whiff: ["A swing that wide misses the question."],
            combo: ["Point, support, conclusion."],
            special: ["Q.E.D."],
          },
        },
      },
    },
  };

  // Returns a Promise resolving to a normalized content bundle.
  VK.loadData = function loadData() {
    var urls = VK.config.dataUrls || { fallacies: VK.config.dataUrl || "data/fallacies.json" };

    return Promise.all([
      loadJson(urls.fallacies || "data/fallacies.json", "fallacies", FALLBACK.fallacies),
      loadJson(urls.topics || "data/topics.json", "topics", FALLBACK.categories),
      loadJson(urls.fighters || "data/fighters.json", "fighters", FALLBACK.fighters),
      loadJson(urls.locations || "data/locations.json", "locations", FALLBACK.locations),
      loadLines(urls.linesBase || "data/lines"),
    ]).then(function (results) {
      return {
        fallacies: normalizeFallacies(results[0], "data/fallacies.json"),
        topics: normalizeTopics(results[1], "data/topics.json"),
        fighters: normalizeFighters(results[2], "data/fighters.json"),
        locations: normalizeLocations(results[3], "data/locations.json"),
        lines: results[4],
      };
    });
  };

  function loadJson(url, label, fallbackArray) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch(function (err) {
        console.warn(
          "[VK] Could not load " + url + " (" + err.message + "). Using built-in demo " + label + "."
        );
        var wrapped = { version: 1 };
        wrapped[label === "topics" ? "categories" : label] = fallbackArray;
        return wrapped;
      });
  }

  function loadLines(baseUrl) {
    var files = ["logician.json", "demagogue.json", "empiricist.json", "trickster.json"];
    return Promise.all(
      files.map(function (file) {
        return fetch(baseUrl + "/" + file)
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .catch(function (err) {
            console.warn("[VK] Could not load " + baseUrl + "/" + file + " (" + err.message + ").");
            return null;
          });
      })
    ).then(function (entries) {
      var map = {};
      entries.forEach(function (entry) {
        if (entry && typeof entry.fighterId === "string") {
          map[entry.fighterId] = entry;
        }
      });
      return map;
    });
  }

  // Drop malformed entries so the engine can trust what it gets.
  function normalizeFallacies(json, source) {
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

  function normalizeTopics(json, source) {
    var list = (json && json.categories) || [];
    var clean = list.filter(function (c) {
      return (
        c &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        Array.isArray(c.questions) &&
        c.questions.every(function (q) { return typeof q === "string"; })
      );
    });
    if (clean.length === 0) {
      throw new Error("No valid topic categories in " + source);
    }
    return clean;
  }

  function normalizeFighters(json, source) {
    var list = (json && json.fighters) || [];
    var clean = list.filter(function (f) {
      return (
        f &&
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        f.stats &&
        isValidScore(f.stats.reach) &&
        isValidScore(f.stats.speed) &&
        isValidScore(f.stats.power) &&
        isValidScore(f.stats.defense) &&
        Array.isArray(f.lineBankKeys)
      );
    });
    if (clean.length === 0) {
      throw new Error("No valid fighters in " + source);
    }
    return clean;
  }

  function normalizeLocations(json, source) {
    var list = (json && json.locations) || [];
    var clean = list.filter(function (loc) {
      return (
        loc &&
        typeof loc.id === "string" &&
        typeof loc.name === "string" &&
        loc.environmentalEvent &&
        typeof loc.environmentalEvent.id === "string" &&
        typeof loc.environmentalEvent.trigger === "string"
      );
    });
    if (clean.length === 0) {
      throw new Error("No valid locations in " + source);
    }
    return clean;
  }

  function isValidScore(value) {
    return Number.isInteger(value) && value >= 1 && value <= 10;
  }
})(window.VK);
