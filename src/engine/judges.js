/*
 * judges.js — compute the 3-judge verdict from the match ledger.
 *
 * Each judge is a weight vector over ledger event types. Scores are clamped
 * to 0–100 and returned with the moments that contributed most to the final
 * tally.
 */
(function (VK) {
  "use strict";

  var JUDGES = [
    {
      id: "idealist",
      name: "The Idealist",
      weights: { hit: 3, countered: -1, fizzle: -2, ko: 5 },
      quote: "Logical consistency wins arguments."
    },
    {
      id: "empiricist",
      name: "The Empiricist",
      weights: { hit: 2, countered: 2, ko: 4, fizzle: -3 },
      quote: "Evidence and execution matter most."
    },
    {
      id: "skeptic",
      name: "The Skeptic",
      weights: { countered: 4, hit: 1, fizzle: -1, ko: 3 },
      quote: "Discipline and rebuttal decide the day."
    },
  ];

  function scoreJudge(judge, ledger) {
    var total = 0;
    var moments = [];
    ledger.forEach(function (event) {
      var w = judge.weights[event.type] || 0;
      if (w !== 0) {
        total += w;
        moments.push({ type: event.type, weight: w, message: event.message || "" });
      }
    });

    // Normalize around a 0–100 scale with a small base so even quiet matches
    // produce visible scores.
    var raw = 50 + total * 3;
    var value = Math.max(0, Math.min(100, raw));

    moments.sort(function (a, b) { return Math.abs(b.weight) - Math.abs(a.weight); });

    return {
      id: judge.id,
      name: judge.name,
      quote: judge.quote,
      score: Math.round(value),
      moments: moments.slice(0, 3),
    };
  }

  function verdict(scores) {
    var total = scores.reduce(function (sum, s) { return sum + s.score; }, 0);
    var avg = total / scores.length;
    return {
      winner: avg >= 50 ? "player" : "enemy",
      label: avg >= 50 ? "YOU WIN — THE FINAL WORD" : "YOU LOSE",
      average: Math.round(avg),
    };
  }

  function scoreLedger(ledger) {
    var scores = JUDGES.map(function (judge) { return scoreJudge(judge, ledger); });
    return {
      judges: scores,
      verdict: verdict(scores),
    };
  }

  VK.judges = { scoreLedger: scoreLedger, JUDGES: JUDGES };
})(window.VK);
