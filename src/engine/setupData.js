/*
 * setupData.js — loads the content used by the selection screens.
 *
 * Topics, fighters, and locations are loaded from JSON and returned as
 * plain arrays. If fetch fails (file://, network error), a minimal fallback
 * set keeps the boot path alive so the e2e smoke test can still run.
 */
(function (VK) {
  "use strict";

  var FALLBACK = {
    topics: {
      version: 1,
      categories: [
        {
          id: "food",
          name: "Food",
          questions: ["Should pineapple belong on pizza?"],
          bank: "default",
        },
      ],
    },
    fighters: {
      version: 1,
      fighters: [
        { id: "logician", name: "The Logician", style: "Counter-focused", stats: { precision: 8, pressure: 5 }, special: "Reductio Ad Absurdum" },
        { id: "demagogue", name: "The Demagogue", style: "Heavy swings", stats: { precision: 5, pressure: 8 }, special: "The Big Lie" },
      ],
    },
    locations: {
      version: 1,
      locations: [
        { id: "forum", name: "The Forum", palette: "warm", event: { name: "Echo Chamber", description: "..." } },
        { id: "studio", name: "The Studio", palette: "cool", event: { name: "Hot Mic", description: "..." } },
      ],
    },
  };

  function loadJSON(url, fallback) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch(function (err) {
        console.warn("[VK] Could not load " + url + " (" + err.message + "). Using fallback.");
        return fallback;
      });
  }

  function load() {
    return Promise.all([
      loadJSON("data/topics.json", FALLBACK.topics),
      loadJSON("data/fighters.json", FALLBACK.fighters),
      loadJSON("data/locations.json", FALLBACK.locations),
    ]).then(function (results) {
      return {
        topics: (results[0] && results[0].categories) || [],
        fighters: (results[1] && results[1].fighters) || [],
        locations: (results[2] && results[2].locations) || [],
      };
    });
  }

  VK.setupData = { load: load };
})(window.VK);
