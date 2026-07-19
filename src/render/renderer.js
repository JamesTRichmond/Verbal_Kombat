/*
 * renderer.js — draws the current state to the canvas and updates the
 * accessibility / verdict overlay. Read-only over state.
 *
 * Deliberately simple: two fighters, health + composure bars, a move menu,
 * and the latest combat line. Swap these primitives for sprites/art later
 * without touching engine logic.
 */
(function (VK) {
  "use strict";

  var COLORS = {
    p1: "#4aa3e4",
    p2: "#c8102e",
    ink: "#f5f2ea",
    muted: "#9a94a6",
    panel: "rgba(20,20,29,0.85)",
    health: "#c8102e",
    composure: "#e4b04a",
    track: "#2a2536",
  };

  // Lazy-cached overlay DOM node.
  var overlayEl = null;
  function overlayNode() {
    if (!overlayEl) overlayEl = document.getElementById("verdict-overlay");
    return overlayEl;
  }

  function draw(ctx, state) {
    var W = ctx.canvas.width;
    var H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);

    drawFloor(ctx, W, H);

    var p = state.fighters.player;
    var e = state.fighters.enemy;

    drawFighter(ctx, p, W * 0.28, H * 0.62, COLORS.p1);
    drawFighter(ctx, e, W * 0.72, H * 0.62, COLORS.p2);

    drawBars(ctx, p, 24, 24, +1);
    drawBars(ctx, e, W - 24, 24, -1);

    if (state.phase === "ready") {
      banner(ctx, W, H, "PRESS SPACE TO FIGHT", COLORS.ink);
      hideOverlay();
    } else if (state.phase === "ko") {
      banner(
        ctx,
        W,
        H,
        (state.winner ? state.winner.name.toUpperCase() : "") + " WINS",
        state.winner && state.winner.id === "player" ? COLORS.p1 : COLORS.p2
      );
      subBanner(ctx, W, H, "Space to rematch");
      showVerdict(state);
    } else {
      drawMoveMenu(ctx, state.moves, W, H);
      hideOverlay();
    }

    drawLog(ctx, state.log, W, H);
  }

  function hideOverlay() {
    var el = overlayNode();
    if (el) el.hidden = true;
  }

  function showVerdict(state) {
    var el = overlayNode();
    if (!el) return;
    el.hidden = false;
    el.innerHTML = renderVerdictHTML(state);
    var closeBtn = el.querySelector("#verdict-close");
    if (closeBtn) closeBtn.focus();
  }

  function renderVerdictHTML(state) {
    var verdict = VK.judges.scoreMatch(state.ledger);
    var closing = VK.judges.closingStatement(state.ledger, verdict.winner);
    var player = state.fighters.player;
    var enemy = state.fighters.enemy;
    var winnerColor = verdict.winner.id === "player" ? COLORS.p1 : COLORS.p2;

    var html = '<div class="verdict-dialog" role="dialog" aria-modal="true" aria-labelledby="verdict-title">';
    html += '<h2 id="verdict-title" class="verdict-title" style="color:' + winnerColor + '">' +
      escapeHtml(verdict.winner.name) + " wins — " + verdict.playerWins + " to " + verdict.enemyWins +
      "</h2>";
    html += '<p class="verdict-closing">' + escapeHtml(closing) + "</p>";
    html += '<div class="verdict-scorecards">';

    verdict.judges.forEach(function (j) {
      var won = j.winner.id === player.id;
      var topSource = won ? j.player : j.enemy;
      html += '<article class="scorecard">';
      html += '<h3>' + escapeHtml(j.judge.name) + "</h3>";
      html += '<p class="judge-focus">' + escapeHtml(j.judge.focus) + "</p>";
      html += '<div class="score-row">';
      html += scoreCell(player.name, j.player.total, won);
      html += scoreCell(enemy.name, j.enemy.total, !won);
      html += "</div>";
      html += '<h4>Top moments</h4>';
      html += '<ol class="top-moments">';
      topSource.top.forEach(function (entry) {
        html += '<li>' + momentLine(entry) + "</li>";
      });
      html += "</ol>";
      html += "</article>";
    });

    html += "</div>";
    html += '<button id="verdict-close" type="button" class="verdict-button">Rematch</button>';
    html += "</div>";
    return html;
  }

  function scoreCell(name, score, won) {
    return '<div class="score-cell' + (won ? " score-cell--won" : "") + '">' +
      '<strong>' + Math.round(score) + "</strong>" +
      "<span>" + escapeHtml(name) + "</span>" +
      "</div>";
  }

  function momentLine(entry) {
    var ev = entry.event;
    var time = VK.ledger.formatTime(ev.timestamp);
    var move = ev.move && ev.move.name ? ev.move.name : "exchange";
    var sign = entry.score > 0 ? "+" : "";
    return escapeHtml(time + " — " + move.toLowerCase() + ", " + sign + Math.round(entry.score));
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function drawFloor(ctx, W, H) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
  }

  // A fighter is a simple stylized figure for now — a stand-in for real art.
  function drawFighter(ctx, f, x, y, color) {
    var alive = f.health > 0;
    ctx.save();
    ctx.globalAlpha = alive ? 1 : 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 70, 26, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.fillRect(x - 22, y - 44, 44, 70);   // torso
    ctx.restore();

    ctx.fillStyle = COLORS.ink;
    ctx.font = "16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.name, x, y + 46);
  }

  function drawBars(ctx, f, x, y, dir) {
    var maxH = VK.config.fighter.maxHealth;
    var maxC = VK.config.fighter.maxComposure;
    var w = 320;
    var bx = dir > 0 ? x : x - w;

    bar(ctx, bx, y, w, 20, f.health / maxH, COLORS.health, dir);
    bar(ctx, bx, y + 26, w, 10, f.composure / maxC, COLORS.composure, dir);
  }

  function bar(ctx, x, y, w, h, pct, color, dir) {
    pct = Math.max(0, Math.min(1, pct));
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    var fw = w * pct;
    // Fill drains toward the center of the screen.
    if (dir > 0) ctx.fillRect(x, y, fw, h);
    else ctx.fillRect(x + (w - fw), y, fw, h);
  }

  function drawMoveMenu(ctx, moves, W, H) {
    ctx.textAlign = "left";
    ctx.font = "14px Trebuchet MS, sans-serif";
    var x = 24;
    var y = H - 96;
    moves.slice(0, 4).forEach(function (m, i) {
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(x, y + i * 22 - 14, 360, 20);
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(
        "[" + (i + 1) + "] " + m.name + "  ·  dmg " + m.damage + " / risk " + m.risk,
        x + 8,
        y + i * 22
      );
    });
  }

  function drawLog(ctx, log, W, H) {
    if (!log.length) return;
    var last = log[log.length - 1];
    ctx.fillStyle = COLORS.muted;
    ctx.font = "italic 15px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(last.message || "", W / 2, H - 24);
  }

  function banner(ctx, W, H, text, color) {
    ctx.fillStyle = color;
    ctx.font = "bold 40px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, W / 2, H / 2);
  }

  function subBanner(ctx, W, H, text) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "18px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, W / 2, H / 2 + 34);
  }

  VK.renderer = { draw: draw };
})(window.VK);
