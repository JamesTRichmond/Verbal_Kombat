/*
 * renderer.js — draws the current state to the canvas. Read-only over state.
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
    } else if (state.phase === "ko") {
      banner(ctx, W, H, (state.winner ? state.winner.name.toUpperCase() : "") + " WINS", COLORS.p2);
      subBanner(ctx, W, H, "Space to rematch");
    } else {
      drawMoveMenu(ctx, state.moves, W, H);
    }

    drawLog(ctx, state.log, W, H);
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
