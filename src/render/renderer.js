/*
 * renderer.js — draws the current state to the canvas. Read-only over state.
 *
 * Deliberately simple: two positional fighters, health + meter bars, timer,
 * and the latest ledger line. Swap these primitives for sprites/art later
 * without touching engine logic.
 */
(function (VK) {
  "use strict";

  var COLORS = {
    ink: "#f5f2ea",
    muted: "#9a94a6",
    panel: "rgba(20,20,29,0.85)",
    health: "#c8102e",
    meter: "#e4b04a",
    track: "#2a2536",
    block: "#7fd6ff",
  };

  function draw(ctx, state) {
    var W = ctx.canvas.width;
    var H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);

    drawFloor(ctx, W, H);

    var p = state.fighters.player;
    var e = state.fighters.enemy;

    drawFighter(ctx, p, p.x, H * 0.72, p.palette);
    drawFighter(ctx, e, e.x, H * 0.72, e.palette);

    drawBars(ctx, p, 24, 24, +1);
    drawBars(ctx, e, W - 24, 24, -1);

    drawTimer(ctx, state.time, W, H);

    if (state.phase === "ready") {
      banner(ctx, W, H, "PRESS SPACE TO FIGHT", COLORS.ink);
    } else if (state.phase === "ended") {
      banner(
        ctx,
        W,
        H,
        (state.winner ? state.winner.name.toUpperCase() : "DRAW"),
        state.winner ? (state.winner.id === "logician" ? p.palette : e.palette) : COLORS.ink
      );
      subBanner(ctx, W, H, "Space to rematch");
    } else {
      drawControls(ctx, W, H);
    }

    drawLedgerLine(ctx, state.ledger, W, H);
  }

  function drawFloor(ctx, W, H) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
  }

  function drawFighter(ctx, f, x, y, color) {
    var alive = f.health > 0;
    var groundY = y + f.y;
    ctx.save();
    ctx.globalAlpha = alive ? 1 : 0.35;
    ctx.fillStyle = color;
    if (f.isBlocking) {
      ctx.strokeStyle = COLORS.block;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 26, groundY - 96, 52, 96);
    }
    ctx.beginPath();
    ctx.arc(x, groundY - 70, 26, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.fillRect(x - 22, groundY - 44, 44, 70);   // torso

    // Facing indicator
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    var dir = f.facing > 0 ? 1 : -1;
    ctx.moveTo(x + dir * 28, groundY - 70);
    ctx.lineTo(x + dir * 44, groundY - 62);
    ctx.lineTo(x + dir * 44, groundY - 78);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = COLORS.ink;
    ctx.font = "16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.name, x, groundY + 46);

    // Hitbox / attack indicator
    if (f.attack) {
      var m = f.attack.move;
      var reach = x + f.facing * (m.range + 22);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(reach, groundY - 48, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawBars(ctx, f, x, y, dir) {
    var maxH = VK.config.fighter.maxHealth;
    var maxM = VK.config.fighter.maxMeter;
    var w = 320;
    var bx = dir > 0 ? x : x - w;

    bar(ctx, bx, y, w, 20, f.health / maxH, COLORS.health, dir);
    bar(ctx, bx, y + 26, w, 10, f.meter / maxM, COLORS.meter, dir);
  }

  function bar(ctx, x, y, w, h, pct, color, dir) {
    pct = Math.max(0, Math.min(1, pct));
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    var fw = w * pct;
    if (dir > 0) ctx.fillRect(x, y, fw, h);
    else ctx.fillRect(x + (w - fw), y, fw, h);
  }

  function drawTimer(ctx, time, W, H) {
    var label = Math.ceil(time).toString();
    ctx.fillStyle = COLORS.ink;
    ctx.font = "bold 28px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, W / 2, 44);
  }

  function drawControls(ctx, W, H) {
    ctx.textAlign = "left";
    ctx.font = "14px Trebuchet MS, sans-serif";
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(24, H - 80, 260, 56);
    ctx.fillStyle = COLORS.ink;
    var lines = [
      "Move: ← →  ·  Block: B",
      "Light: J  ·  Heavy: K  ·  Special: L",
    ];
    lines.forEach(function (line, i) {
      ctx.fillText(line, 36, H - 56 + i * 22);
    });
  }

  function drawLedgerLine(ctx, ledger, W, H) {
    if (!ledger || !ledger.events.length) return;
    var last = ledger.events[ledger.events.length - 1];
    if (!last.message) return;
    ctx.fillStyle = COLORS.muted;
    ctx.font = "italic 15px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(last.message, W / 2, H - 24);
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
