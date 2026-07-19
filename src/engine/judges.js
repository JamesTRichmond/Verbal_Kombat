/*
 * judges.js — three weight-vector judges over the match ledger.
 *
 * Each judge scores the same ledger events using its own weights, producing
 * per-fighter totals and a list of the top contributing moments. This makes
 * the verdict reproducible and explainable (D3, D8).
 */
(function (VK) {
  "use strict";

  // Judge definitions. Weights apply to events where the fighter is the
  // attacker; negative weights apply when the fighter is the defender in a
  // counter or when their move fizzles.
  var JUDGES = [
    {
      id: "idealist",
      name: "The Idealist",
      focus: "logical consistency, rhetorical technique",
      weights: {
        hit: { technique: 1.0, consistency: 0.5 },
        countered: { consistency: -1.0, technique: -0.3 },
        fizzle: { consistency: -0.8, technique: -0.2 },
      },
    },
    {
      id: "empiricist",
      name: "The Empiricist",
      focus: "evidence quality, relevance, execution",
      weights: {
        hit: { execution: 1.0, relevance: 0.6 },
        countered: { execution: -0.8, relevance: -0.5 },
        fizzle: { execution: -0.6, relevance: -0.2 },
      },
    },
    {
      id: "skeptic",
      name: "The Skeptic",
      focus: "rebuttals, discipline, combat control",
      weights: {
        countered: { rebuttal: 1.2, control: 0.5 }, // defender earns rebuttal credit
        hit: { discipline: 0.4, control: 0.3 },
        fizzle: { discipline: -1.0, control: -0.4 },
      },
    },
  ];

  // Map move properties to judge dimensions.
  function eventScore(judge, event, fighterId) {
    var w = judge.weights[event.type];
    if (!w) return 0;

    var move = event.move || {};
    var isAttacker = event.attacker === fighterId;
    var isDefender = event.defender === fighterId;

    // Fizzles hurt the attacker; counters credit the defender and penalize the
    // attacker; hits credit the attacker.
    if (event.type === "fizzle") {
      if (!isAttacker) return 0;
      return -1.5 + (move.damage || 0) * -0.2;
    }

    if (event.type === "countered") {
      if (isDefender) {
        return (move.risk || 0) * (w.rebuttal || 0) + (w.control || 0);
      }
      if (isAttacker) {
        return -1 * ((move.risk || 0) * (w.consistency || w.execution || 0) + (w.technique || 0));
      }
      return 0;
    }

    if (event.type === "hit") {
      if (!isAttacker) return 0;
      var base = (move.damage || 0) * (w.execution || w.technique || 0);
      var riskPenalty = (move.risk || 0) * (w.consistency || w.discipline || 0) * 0.15;
      return base - riskPenalty + (w.relevance || w.control || 0);
    }

    return 0;
  }

  function judgeEvents(judge, ledger, fighterId) {
    return ledger.events
      .map(function (event, index) {
        return {
          index: index,
          event: event,
          score: eventScore(judge, event, fighterId),
        };
      })
      .filter(function (entry) {
        return entry.score !== 0;
      });
  }

  function scoreFighter(judge, ledger, fighterId) {
    var entries = judgeEvents(judge, ledger, fighterId);
    var total = entries.reduce(function (sum, e) {
      return sum + e.score;
    }, 0);
    var top = entries
      .slice()
      .sort(function (a, b) {
        return Math.abs(b.score) - Math.abs(a.score);
      })
      .slice(0, 3);
    return { total: total, entries: entries, top: top };
  }

  function scoreMatch(ledger) {
    var playerId = ledger.header.player.id;
    var enemyId = ledger.header.enemy.id;
    var results = JUDGES.map(function (judge) {
      var player = scoreFighter(judge, ledger, playerId);
      var enemy = scoreFighter(judge, ledger, enemyId);
      var winner = player.total > enemy.total ? ledger.header.player : ledger.header.enemy;
      return {
        judge: judge,
        player: player,
        enemy: enemy,
        winner: winner,
        margin: Math.abs(player.total - enemy.total),
      };
    });

    var playerWins = results.filter(function (r) {
      return r.winner.id === playerId;
    }).length;
    var matchWinner = playerWins >= 2 ? ledger.header.player : ledger.header.enemy;

    return {
      judges: results,
      winner: matchWinner,
      playerWins: playerWins,
      enemyWins: JUDGES.length - playerWins,
    };
  }

  // Build a short closing statement from the winner's strongest ledger run.
  // A "run" is a sequence of events by the same fighter; we pick the longest
  // run, breaking ties by total event score.
  function closingStatement(ledger, winner) {
    var events = ledger.events;
    var bestRun = null;
    var currentRun = [];

    function runScore(run) {
      return run.reduce(function (sum, ev) {
        return sum + (ev.damage || 0);
      }, 0);
    }

    function finalizeRun(run) {
      if (!run.length) return;
      if (!bestRun || run.length > bestRun.length || (run.length === bestRun.length && runScore(run) > runScore(bestRun))) {
        bestRun = run.slice();
      }
    }

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var attacker = ev.attacker;
      if (attacker === winner.id) {
        currentRun.push(ev);
      } else {
        finalizeRun(currentRun);
        currentRun = [];
      }
    }
    finalizeRun(currentRun);

    if (!bestRun || bestRun.length === 0) {
      return winner.name + " sealed the win through steady pressure.";
    }

    var last = bestRun[bestRun.length - 1];
    var count = bestRun.length;
    var moveName = last.move && last.move.name ? last.move.name : "the final exchange";
    var time = VK.ledger.formatTime(last.timestamp);

    if (count === 1) {
      return winner.name + " landed the decisive " + moveName.toLowerCase() + " at " + time + " to close the argument.";
    }

    return (
      winner.name +
      " strung together " +
      count +
      " unanswered exchanges, finishing with " +
      moveName.toLowerCase() +
      " at " +
      time +
      " for the final word."
    );
  }

  VK.judges = {
    list: JUDGES,
    scoreMatch: scoreMatch,
    closingStatement: closingStatement,
    scoreFighter: scoreFighter,
  };
})(window.VK);
