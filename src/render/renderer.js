/*
 * renderer.js — draws the current state to the canvas. Read-only over state.
 *
 * Deliberately simple primitives (no sprites yet): two fighters, health +
 * composure bars, round pips, the incoming-argument telegraph with its timing
 * bar, a move menu, and a short combat log. Swap primitives for art later
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
    warn: "#e4b04a",
    good: "#5ac86b",
  };

  function draw(ctx, state) {
    var W = ctx.canvas.width;
    var H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);

    drawFloor(ctx, W, H);

    var p = state.fighters.player;
    var e = state.fighters.enemy;

    drawFighter(ctx, p, W * 0.28, H * 0.62, COLORS.p1, state, "player");
    drawFighter(ctx, e, W * 0.72, H * 0.62, COLORS.p2, state, "enemy");

    drawBars(ctx, p, 24, 24, +1);
    drawBars(ctx, e, W - 24, 24, -1);
    drawRoundPips(ctx, state, W);

    if (state.phase === "ready") {
      banner(ctx, W, H, "PRESS SPACE TO FIGHT", COLORS.ink);
      subBanner(ctx, W, H, "1–4 argue · F rebuts the incoming attack · best of 3");
    } else if (state.phase === "matchover") {
      banner(ctx, W, H, (state.winner ? state.winner.name.toUpperCase() : "") + " WINS", COLORS.p2);
      subBanner(ctx, W, H, "Space to rematch");
    } else if (state.phase === "roundover") {
      banner(ctx, W, H, "ROUND OVER", COLORS.warn);
    } else {
      // fighting
      drawMoveMenu(ctx, state, W, H);
      if (state.riposte) drawTelegraph(ctx, state.riposte, W, H);
    }

    drawLog(ctx, state.log, W, H);
  }

  function drawFloor(ctx, W, H) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
  }

  // A fighter is a simple stylized figure for now — a stand-in for real art.
  // Flashes when a telegraphed attack is aimed at the player.
  function drawFighter(ctx, f, x, y, color, state, id) {
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

  // Round tally as pips under each health bar (best of `roundsToWin` * 2 - 1).
  function drawRoundPips(ctx, state, W) {
    var need = state.roundsToWin;
    drawPips(ctx, state.rounds.player, need, 24, 62, +1);
    drawPips(ctx, state.rounds.enemy, need, W - 24, 62, -1);
  }

  function drawPips(ctx, won, need, x, y, dir) {
    var r = 6, gap = 20;
    for (var i = 0; i < need; i++) {
      var cx = dir > 0 ? x + r + i * gap : x - r - i * gap;
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i < won ? COLORS.good : COLORS.track;
      ctx.fill();
    }
  }

  // Paginated roster: `pageSize` moves at a time, keyed 1..pageSize.
  function drawMoveMenu(ctx, state, W, H) {
    var pageSize = VK.config.moves.pageSize;
    var pages = VK.state.pageCount(state);
    var start = state.movePage * pageSize;
    var page = state.moves.slice(start, start + pageSize);

    var x = 24;
    var rowH = 22;
    var topY = H - 40 - pageSize * rowH; // grows upward from a fixed bottom

    ctx.textAlign = "left";
    ctx.font = "bold 13px Trebuchet MS, sans-serif";
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(
      "ARGUMENTS  ·  page " + (state.movePage + 1) + "/" + pages + "  ·  [Q]/[E] switch",
      x,
      topY - 8
    );

    ctx.font = "14px Trebuchet MS, sans-serif";
    page.forEach(function (m, i) {
      var y = topY + i * rowH;
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(x, y - 14, 360, 20);
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(
        "[" + (i + 1) + "] " + m.name + "  ·  dmg " + m.damage + " / risk " + m.risk,
        x + 8,
        y
      );
    });
  }

  // The enemy's incoming argument + a shrinking window to press F.
  function drawTelegraph(ctx, riposte, W, H) {
    var pct = Math.max(0, riposte.timeLeft / riposte.windowSeconds);
    var pw = 420, ph = 74;
    var x = (W - pw) / 2, y = H * 0.30;

    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = COLORS.warn;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, pw, ph);

    ctx.fillStyle = COLORS.warn;
    ctx.font = "bold 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("INCOMING: " + riposte.move.name + " — press F to rebut!", W / 2, y + 24);

    // Timing bar drains left-to-right as the window closes.
    var barX = x + 20, barW = pw - 40, barY = y + 40;
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(barX, barY, barW, 12);
    ctx.fillStyle = pct > 0.4 ? COLORS.good : COLORS.warn;
    ctx.fillRect(barX, barY, barW * pct, 12);
  }

  function drawLog(ctx, log, W, H) {
    if (!log.length) return;
    ctx.textAlign = "center";
    var lines = log.slice(-3);
    for (var i = 0; i < lines.length; i++) {
      // Oldest of the three is faintest.
      var alpha = 0.4 + 0.3 * i;
      ctx.fillStyle = "rgba(154,148,166," + alpha + ")";
      ctx.font = (i === lines.length - 1 ? "italic 15px" : "italic 13px") + " Trebuchet MS, sans-serif";
      ctx.fillText(lines[i].message || "", W / 2, H - 42 + i * 16);
    }
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
