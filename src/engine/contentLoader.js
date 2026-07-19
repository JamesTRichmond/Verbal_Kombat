/*
 * contentLoader.js — loads the pivot's content: topics, fighters, locations,
 * and per-fighter dialogue line banks.
 *
 * Same contract as dataLoader.js: try to fetch the JSON files under data/,
 * and if fetch is unavailable (e.g. Chrome blocks fetch on file://) fall back
 * to a small built-in set so the game still boots. The JSON files remain the
 * source of truth; the fallback is only enough to keep the loop alive.
 *
 * Schemas are documented in data/README.md. Everything loaded here is
 * validated; malformed entries are dropped so the engine can trust the shape.
 */
(function (VK) {
  "use strict";

  // Ledger event types a line bank must cover. The dialogue engine (and the
  // node-side data tests) treat this list as the schema's event vocabulary.
  var EVENT_TYPES = [
    "lightHit",
    "heavyHit",
    "combo",
    "special",
    "whiff",
    "blocked",
    "counter",
    "victory",
    "defeat",
  ];

  // Placeholders allowed inside line templates. {topic} and {opponent} are
  // filled from match state; the rest come from the topic category's vocab.
  var PLACEHOLDERS = [
    "topic",
    "stanceFor",
    "stanceAgainst",
    "evidence",
    "expert",
    "opponent",
  ];

  var FALLBACK = {
    topics: {
      version: 1,
      categories: [
        {
          id: "food",
          label: "Food",
          questions: [
            { id: "pineapple_pizza", text: "Does pineapple belong on pizza?" },
            { id: "cereal_soup", text: "Is cereal a soup?" },
            { id: "best_condiment", text: "Is ketchup the only condiment anyone actually needs?" },
          ],
          vocab: {
            stanceFor: "flavor is about contrast, not tradition",
            stanceAgainst: "some pairings are simply mistakes",
            evidence: "sweet-and-savory pairings appear in every cuisine",
            expert: "any working chef",
          },
        },
      ],
    },
    fighters: {
      version: 1,
      fighters: [
        {
          id: "logician",
          name: "The Logician",
          tagline: "Every step follows.",
          style: {
            argument: "Airtight chains of reasoning.",
            combat: "Precise and counter-focused.",
          },
          stats: { power: 5, speed: 7 },
          special: {
            id: "syllogism",
            name: "The Syllogism",
            description: "A three-part chain the opponent cannot step out of.",
          },
          lineBank: "logician",
          cpu: {
            aggressionCurve: [{ untilTick: 3600, aggression: 0.5 }],
            punishWindowTicks: 18,
            blockBias: 0.6,
            preferredRange: "mid",
          },
        },
        {
          id: "demagogue",
          name: "The Demagogue",
          tagline: "The crowd is already with me.",
          style: {
            argument: "Sweeping claims delivered loud.",
            combat: "Heavy swings and forward pressure.",
          },
          stats: { power: 9, speed: 4 },
          special: {
            id: "rally",
            name: "Rally the Crowd",
            description: "Whips the audience into a roar.",
          },
          lineBank: "demagogue",
          cpu: {
            aggressionCurve: [{ untilTick: 3600, aggression: 0.8 }],
            punishWindowTicks: 10,
            blockBias: 0.2,
            preferredRange: "close",
          },
        },
      ],
    },
    locations: {
      version: 1,
      locations: [
        {
          id: "forum",
          name: "The Forum",
          description: "Sun-bleached stone and a restless crowd.",
          palette: {
            sky: "#e8d5a3",
            backdrop: "#b08d57",
            floor: "#8a6f45",
            accent: "#5b3a29",
          },
          parallaxLayers: ["colonnade", "crowd", "dais"],
          event: {
            id: "echo",
            name: "The Echo",
            trigger: { atTick: 1800 },
            effect: {
              type: "dialogue_weight",
              target: "next_landed_point",
              multiplier: 2,
            },
            announcement: "The colonnade catches the words.",
          },
        },
      ],
    },
    lines: {
      logician: minimalBank("logician", "Premise noted. It follows."),
      demagogue: minimalBank("demagogue", "The crowd heard that!"),
    },
  };

  function minimalBank(fighter, line) {
    var events = {};
    for (var i = 0; i < EVENT_TYPES.length; i++) events[EVENT_TYPES[i]] = [line];
    return { version: 1, fighter: fighter, events: events };
  }

  // Custom questions are player-typed free text. The renderer only ever puts
  // them on screen via canvas fillText or DOM textContent — never innerHTML —
  // but sanitize anyway so the stored match state (and any future export of
  // the ledger) is inert: strip markup and control characters, collapse
  // whitespace, cap the length.
  function sanitizeCustomQuestion(text) {
    if (typeof text !== "string") return "";
    var max =
      (VK.config && VK.config.content && VK.config.content.maxCustomQuestionLength) ||
      140;
    var s = text
      .replace(/[\u0000-\u001f\u007f]/g, " ") // control chars
      .replace(/<[^>]*>/g, " ") // anything tag-shaped
      .replace(/[<>]/g, " ") // stray angle brackets
      .replace(/\s+/g, " ")
      .trim();
    return s.slice(0, max).trim();
  }

  // Resolve the lines for (bank, categoryId, eventType), applying the bank's
  // per-category overrides when present. Returns a (possibly empty) array of
  // raw templates; interpolation of {placeholders} is the dialogue engine's
  // job because it needs live match state.
  function linesFor(bank, categoryId, eventType) {
    if (!bank || !bank.events) return [];
    var overrides = bank.categoryOverrides && bank.categoryOverrides[categoryId];
    if (overrides && Array.isArray(overrides[eventType]) && overrides[eventType].length) {
      return overrides[eventType];
    }
    return Array.isArray(bank.events[eventType]) ? bank.events[eventType] : [];
  }

  // Release 1 requires the FULL set from served content — 8 categories, 4
  // fighters, 2 arenas (see data/README.md). A reachable file that validates
  // but comes up short (say, one surviving category) would leave the
  // selection screens half-empty, so short payloads degrade to the built-in
  // fallback instead. The fallback itself is exempt from counts: it is
  // deliberately minimal, just enough to keep the loop alive.
  var REQUIRED_COUNTS = { topics: 8, fighters: 4, locations: 2 };

  // Loads everything and resolves to { topics, fighters, locations, lines }
  // where lines is keyed by each fighter's lineBank id. Fighters whose line
  // bank cannot be loaded at all are dropped from the roster — a fighter
  // with fabricated dialogue would break "every line is earned."
  function load() {
    var urls = VK.config.content;
    return Promise.all([
      loadPart(urls.topicsUrl, FALLBACK.topics, normalizeTopics, REQUIRED_COUNTS.topics),
      loadPart(urls.fightersUrl, FALLBACK.fighters, normalizeFighters, REQUIRED_COUNTS.fighters),
      loadPart(urls.locationsUrl, FALLBACK.locations, normalizeLocations, REQUIRED_COUNTS.locations),
    ]).then(function (parts) {
      var fighters = parts[1];
      return loadLineBanks(urls, fighters).then(function (lines) {
        var rostered = fighters.filter(function (f) {
          if (!lines[f.lineBank]) {
            console.warn(
              "[VK] Dropping fighter '" + f.id +
                "': line bank '" + f.lineBank + "' could not be loaded."
            );
            return false;
          }
          return true;
        });
        if (rostered.length === 0) throw new Error("No fighter has a line bank");
        return {
          topics: parts[0],
          fighters: rostered,
          locations: parts[2],
          lines: lines,
        };
      });
    });
  }

  function loadLineBanks(urls, fighters) {
    var keys = [];
    for (var i = 0; i < fighters.length; i++) {
      if (keys.indexOf(fighters[i].lineBank) === -1) keys.push(fighters[i].lineBank);
    }
    return Promise.all(
      keys.map(function (key) {
        // Only banks this file knows about have a fallback. An unknown key
        // (new fighter, typo in fighters.json) with an unreachable file must
        // NOT be synthesized — resolve null and let load() drop the fighter.
        return loadPart(urls.linesUrlPrefix + key + ".json", FALLBACK.lines[key], function (json) {
          return normalizeBank(json, key);
        }).catch(function (err) {
          console.warn("[VK] No usable line bank for '" + key + "': " + err.message);
          return null;
        });
      })
    ).then(function (banks) {
      var byKey = {};
      for (var i = 0; i < banks.length; i++) {
        if (banks[i]) byKey[keys[i]] = banks[i];
      }
      return byKey;
    });
  }

  // Fetch + validate, falling back on ANY failure — network, parse, or
  // schema. Validation must sit inside the caught chain (same as
  // dataLoader.js): a reachable-but-malformed file should degrade to the
  // built-in set, not brick the boot. minCount applies to served content
  // only, never the fallback. If the fallback is missing or fails
  // validation, the throw propagates to the caller.
  function loadPart(url, fallback, normalize, minCount) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        var out = normalize(json);
        if (minCount && out.length < minCount) {
          throw new Error("expected " + minCount + " valid entries, got " + out.length);
        }
        return out;
      })
      .catch(function (err) {
        console.warn(
          "[VK] Could not load " +
            url +
            " (" +
            err.message +
            "). Using built-in fallback. Serve locally (npm start) for full content."
        );
        if (fallback === undefined) throw err;
        return normalize(fallback);
      });
  }

  function normalizeTopics(json) {
    var list = (json && json.categories) || [];
    var clean = list.filter(dedupeById()).filter(function (c) {
      return (
        c &&
        typeof c.id === "string" &&
        typeof c.label === "string" &&
        Array.isArray(c.questions) &&
        c.questions.length === 3 && // the R1 schema: exactly 3 per category
        c.questions.every(function (q) {
          return q && isNonEmptyString(q.id) && isNonEmptyString(q.text);
        }) &&
        c.vocab &&
        VOCAB_KEYS.every(function (key) {
          return isNonEmptyString(c.vocab[key]);
        })
      );
    });
    if (clean.length === 0) throw new Error("No valid topic categories");
    return clean;
  }

  // Ids are the stable keys selection state and overrides hang off — a
  // duplicate makes the reference ambiguous, so only the first occurrence
  // survives. Downstream count checks then treat the loss as a shortfall.
  function dedupeById() {
    var seen = {};
    return function (entry) {
      if (!entry || typeof entry.id !== "string") return true; // let shape checks reject it
      if (seen[entry.id]) {
        console.warn("[VK] Duplicate id '" + entry.id + "' dropped.");
        return false;
      }
      seen[entry.id] = true;
      return true;
    };
  }

  function normalizeFighters(json) {
    var list = (json && json.fighters) || [];
    var clean = list.filter(dedupeById()).filter(function (f) {
      return (
        f &&
        isNonEmptyString(f.id) &&
        isNonEmptyString(f.name) &&
        isNonEmptyString(f.tagline) &&
        f.style &&
        isNonEmptyString(f.style.argument) &&
        isNonEmptyString(f.style.combat) &&
        f.stats &&
        isStat(f.stats.power) &&
        isStat(f.stats.speed) &&
        f.special &&
        isNonEmptyString(f.special.id) &&
        isNonEmptyString(f.special.name) &&
        isNonEmptyString(f.special.description) &&
        isNonEmptyString(f.lineBank) &&
        f.cpu &&
        isValidCpu(f.cpu)
      );
    });
    if (clean.length === 0) throw new Error("No valid fighters");
    return clean;
  }

  function isValidCpu(cpu) {
    if (!Array.isArray(cpu.aggressionCurve) || cpu.aggressionCurve.length === 0) {
      return false;
    }
    var prevTick = 0;
    for (var i = 0; i < cpu.aggressionCurve.length; i++) {
      var seg = cpu.aggressionCurve[i];
      if (
        !seg ||
        !Number.isInteger(seg.untilTick) ||
        seg.untilTick <= prevTick || // ticks must be strictly ascending
        typeof seg.aggression !== "number" ||
        seg.aggression < 0 ||
        seg.aggression > 1
      ) {
        return false;
      }
      prevTick = seg.untilTick;
    }
    return (
      Number.isInteger(cpu.punishWindowTicks) &&
      cpu.punishWindowTicks > 0 &&
      typeof cpu.blockBias === "number" &&
      cpu.blockBias >= 0 &&
      cpu.blockBias <= 1 &&
      ["close", "mid", "far"].indexOf(cpu.preferredRange) !== -1
    );
  }

  function normalizeLocations(json) {
    var list = (json && json.locations) || [];
    var clean = list.filter(dedupeById()).filter(function (l) {
      return (
        l &&
        isNonEmptyString(l.id) &&
        isNonEmptyString(l.name) &&
        isNonEmptyString(l.description) &&
        l.palette &&
        PALETTE_KEYS.every(function (key) {
          return isHexColor(l.palette[key]);
        }) &&
        Array.isArray(l.parallaxLayers) &&
        l.parallaxLayers.length > 0 &&
        l.parallaxLayers.every(isNonEmptyString) &&
        l.event &&
        isNonEmptyString(l.event.id) &&
        isNonEmptyString(l.event.name) &&
        isNonEmptyString(l.event.announcement) &&
        l.event.trigger &&
        Number.isInteger(l.event.trigger.atTick) &&
        l.event.trigger.atTick > 0 &&
        isValidEffect(l.event.effect)
      );
    });
    if (clean.length === 0) throw new Error("No valid locations");
    return clean;
  }

  function isValidEffect(effect) {
    if (!effect) return false;
    if (effect.type === "dialogue_weight") {
      return (
        isNonEmptyString(effect.target) &&
        typeof effect.multiplier === "number" &&
        effect.multiplier > 0
      );
    }
    if (effect.type === "event_weight_bonus") {
      return (
        EVENT_TYPES.indexOf(effect.eventType) !== -1 &&
        typeof effect.bonus === "number" &&
        Number.isInteger(effect.durationTicks) &&
        effect.durationTicks > 0
      );
    }
    return false;
  }

  // A usable template is a non-empty string whose {placeholders} all come
  // from the schema vocabulary. EVERY braced token is checked — {expertt},
  // {stance_for}, {topic1} are all rejected — because any unknown token
  // would reach the ticker as raw text the interpolation layer cannot fill.
  function isValidLine(line) {
    if (typeof line !== "string" || line.length === 0) return false;
    var match;
    var re = /\{([^}]*)\}/g;
    while ((match = re.exec(line)) !== null) {
      if (PLACEHOLDERS.indexOf(match[1]) === -1) return false;
    }
    return true;
  }

  function normalizeBank(json, key) {
    if (!json || !json.events) throw new Error("No line bank for " + key);
    if (json.fighter && json.fighter !== key) {
      console.warn(
        "[VK] Line bank '" + key + "' declares fighter '" + json.fighter +
          "'; using the bank key."
      );
    }
    var events = {};
    for (var i = 0; i < EVENT_TYPES.length; i++) {
      var type = EVENT_TYPES[i];
      var arr = json.events[type];
      events[type] = Array.isArray(arr) ? arr.filter(isValidLine) : [];
      if (events[type].length === 0) {
        // Every event type is required (see data/README.md): an empty bucket
        // would leave the fighter mute for that ledger event. Throw so
        // loadPart degrades to the fallback bank instead.
        throw new Error("Line bank '" + key + "' has no usable lines for " + type);
      }
    }
    // Overrides are filtered exactly like base lines. An override that ends
    // up empty (or names an unknown event type) is discarded so the valid
    // base bucket wins — overrides can only ever replace dialogue with
    // equally valid dialogue.
    var overrides = {};
    var source = json.categoryOverrides || {};
    for (var cat in source) {
      if (!Object.prototype.hasOwnProperty.call(source, cat)) continue;
      for (var type2 in source[cat]) {
        if (!Object.prototype.hasOwnProperty.call(source[cat], type2)) continue;
        if (EVENT_TYPES.indexOf(type2) === -1) {
          console.warn(
            "[VK] Line bank '" + key + "' override for unknown event '" +
              type2 + "' in category '" + cat + "' ignored."
          );
          continue;
        }
        var kept = Array.isArray(source[cat][type2])
          ? source[cat][type2].filter(isValidLine)
          : [];
        if (kept.length === 0) {
          console.warn(
            "[VK] Line bank '" + key + "' override " + cat + "." + type2 +
              " has no usable lines; base bank wins."
          );
          continue;
        }
        if (!overrides[cat]) overrides[cat] = {};
        overrides[cat][type2] = kept;
      }
    }
    return {
      // Banks are addressed by lineBank key/filename; a mismatched `fighter`
      // field is content error, never authority.
      fighter: key,
      events: events,
      categoryOverrides: overrides,
    };
  }

  var VOCAB_KEYS = ["stanceFor", "stanceAgainst", "evidence", "expert"];
  var PALETTE_KEYS = ["sky", "backdrop", "floor", "accent"];

  function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function isStat(value) {
    return Number.isInteger(value) && value >= 1 && value <= 10;
  }

  VK.content = {
    EVENT_TYPES: EVENT_TYPES,
    PLACEHOLDERS: PLACEHOLDERS,
    load: load,
    sanitizeCustomQuestion: sanitizeCustomQuestion,
    linesFor: linesFor,
  };
})(window.VK);
