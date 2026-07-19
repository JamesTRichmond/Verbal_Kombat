/*
 * topicsLoader.js — loads argument categories and questions.
 *
 * Mirrors the dataLoader fallback pattern: if fetch fails (e.g. Chrome blocks
 * file://), we use a tiny built-in set so the argument-select screen still
 * works when index.html is opened directly.
 */
(function (VK) {
  "use strict";

  var FALLBACK = {
    version: 1,
    categories: [
      {
        id: "ethics",
        name: "Ethics",
        lineBank: "ethics",
        questions: [
          "Is it ever okay to tell a white lie?",
          "Should animals have legal rights?",
          "Do the ends ever justify the means?",
        ],
      },
      {
        id: "politics",
        name: "Politics",
        lineBank: "politics",
        questions: [
          "Should voting be mandatory?",
          "Is term limits for elected officials a good idea?",
          "Should political campaigns be publicly funded?",
        ],
      },
      {
        id: "science",
        name: "Science",
        lineBank: "science",
        questions: [
          "Should genetically modified foods be labeled?",
          "Is space exploration worth the cost?",
          "Should humans try to colonize Mars?",
        ],
      },
      {
        id: "arts",
        name: "Arts",
        lineBank: "arts",
        questions: [
          "Should museums return artifacts to their countries of origin?",
          "Is remixing someone else's art fair use?",
          "Should public funding support the arts?",
        ],
      },
    ],
  };

  // Returns a Promise resolving to an array of validated category entries.
  VK.loadTopics = function loadTopics() {
    return fetch(VK.config.topicsUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        return normalize(json, "data/topics.json");
      })
      .catch(function (err) {
        console.warn(
          "[VK] Could not load " +
            VK.config.topicsUrl +
            " (" +
            err.message +
            "). Using built-in demo categories. " +
            "Serve locally (python3 -m http.server) for the full file."
        );
        return normalize(FALLBACK, "built-in fallback");
      });
  };

  function normalize(json, source) {
    var list = (json && json.categories) || [];
    var clean = list.filter(function (c) {
      return (
        c &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        typeof c.lineBank === "string" &&
        Array.isArray(c.questions) &&
        c.questions.every(function (q) {
          return typeof q === "string";
        })
      );
    });
    if (clean.length === 0) {
      throw new Error("No valid categories in " + source);
    }
    return clean;
  }
})(window.VK);
