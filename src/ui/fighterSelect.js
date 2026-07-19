/*
 * fighterSelect.js — fighter selection screen.
 *
 * Renders a keyboard-navigable roster grid and a big identity panel:
 * portrait, style description, two stats, and one named special.
 * Confirms the player's choice and assigns (or lets the player pick) a CPU
 * rival before handing control back to the caller.
 */
(function (VK) {
  "use strict";

  function createSelectScreen(fighters, onConfirm) {
    var container = document.getElementById("select-screen");
    var rosterEl = document.getElementById("select-roster");
    var panelEl = document.getElementById("select-panel");
    if (!container || !rosterEl || !panelEl) {
      console.error("[VK] Fighter select markup missing.");
      return null;
    }

    var playerIndex = 0;
    var enemyIndex = defaultEnemyIndex(fighters, playerIndex);
    var buttons = [];
    var panelHandler = null;

    function renderRoster() {
      rosterEl.innerHTML = "";
      buttons = fighters.map(function (f, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "roster-tile";
        btn.setAttribute("aria-pressed", i === playerIndex ? "true" : "false");
        btn.setAttribute("data-fighter-index", String(i));
        btn.innerHTML =
          '<span class="roster-portrait" aria-hidden="true">' +
          escapeHtml(f.portrait || "?") +
          "</span>" +
          '<span class="roster-name">' +
          escapeHtml(f.name) +
          "</span>";
        // Keyboard focus selects the fighter so the panel always matches
        // the active control; click also selects for mouse users.
        btn.addEventListener("click", function () {
          selectPlayer(i);
        });
        btn.addEventListener("focus", function () {
          selectPlayer(i);
        });
        rosterEl.appendChild(btn);
        return btn;
      });
    }

    function selectPlayer(index) {
      playerIndex = index;
      if (enemyIndex === playerIndex) {
        enemyIndex = defaultEnemyIndex(fighters, playerIndex);
      }
      buttons.forEach(function (btn, i) {
        btn.setAttribute("aria-pressed", i === playerIndex ? "true" : "false");
      });
      renderPanel(fighters[playerIndex], fighters[enemyIndex]);
    }

    function cycleEnemy() {
      var keepFocus = document.activeElement &&
        document.activeElement.id === "select-rival-cycle";
      enemyIndex = (enemyIndex + 1) % fighters.length;
      if (enemyIndex === playerIndex) {
        enemyIndex = (enemyIndex + 1) % fighters.length;
      }
      renderPanel(fighters[playerIndex], fighters[enemyIndex]);
      if (keepFocus) {
        var nextBtn = document.getElementById("select-rival-cycle");
        if (nextBtn) nextBtn.focus();
      }
    }

    function confirm() {
      if (typeof onConfirm === "function") {
        onConfirm(fighters[playerIndex], fighters[enemyIndex]);
      }
    }

    function renderPanel(player, enemy) {
      var stats = Array.isArray(player.stats) ? player.stats : [];
      panelEl.innerHTML =
        '<div class="identity-primary">' +
        '  <div class="identity-portrait" aria-hidden="true">' +
        escapeHtml(player.portrait || "?") +
        "</div>" +
        '  <div class="identity-header">' +
        '    <h2>' + escapeHtml(player.name) + "</h2>" +
        '    <p class="identity-style">' + escapeHtml(player.style) + "</p>" +
        "  </div>" +
        "</div>" +
        '<p class="identity-description">' + escapeHtml(player.description) + "</p>" +
        '<dl class="identity-stats">' +
        renderStat(stats[0]) +
        renderStat(stats[1]) +
        "</dl>" +
        '<div class="identity-special">' +
        '  <h3>Special: ' + escapeHtml(player.special && player.special.name ? player.special.name : "—") + "</h3>" +
        '  <p>' + escapeHtml(player.special && player.special.description ? player.special.description : "") + "</p>" +
        "</div>" +
        '<div class="identity-rival">' +
        '  <span class="rival-label">Rival:</span>' +
        '  <span class="rival-portrait" aria-hidden="true">' +
        escapeHtml(enemy.portrait || "?") +
        "</span>" +
        '  <span class="rival-name">' + escapeHtml(enemy.name) + "</span>" +
        '  <button type="button" class="rival-cycle" id="select-rival-cycle">Change rival</button>' +
        "</div>" +
        '<button type="button" class="confirm-button" id="select-confirm">Enter the arena</button>';

      if (panelHandler) {
        panelEl.removeEventListener("click", panelHandler);
      }
      panelHandler = function (e) {
        if (e.target.id === "select-rival-cycle") cycleEnemy();
        if (e.target.id === "select-confirm") confirm();
      };
      panelEl.addEventListener("click", panelHandler);
    }

    function renderPanelEmpty() {
      panelEl.innerHTML =
        '<p class="identity-placeholder">Choose a fighter to view their style, stats, and special.</p>';
    }

    function show() {
      container.hidden = false;
      renderRoster();
      renderPanelEmpty();
      selectPlayer(playerIndex);
      if (buttons[0]) buttons[0].focus();
    }

    function hide() {
      container.hidden = true;
      if (panelHandler) {
        panelEl.removeEventListener("click", panelHandler);
        panelHandler = null;
      }
    }

    return { show: show, hide: hide };
  }

  function defaultEnemyIndex(fighters, playerIndex) {
    return fighters.length > 1 ? (playerIndex + 1) % fighters.length : 0;
  }

  function renderStat(stat) {
    if (!stat) return "";
    var raw = stat.value === null || stat.value === undefined ? 1 : Number(stat.value);
    var value = Math.max(0, Math.min(10, isNaN(raw) ? 1 : raw));
    return (
      '<div class="stat">' +
      '<dt>' + escapeHtml(stat.label) + "</dt>" +
      '<dd><span class="stat-bar" style="width:' +
      value * 10 +
      '%"></span><span class="stat-value">' +
      value +
      "/10</span></dd>" +
      "</div>"
    );
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  VK.fighterSelect = { create: createSelectScreen };
})(window.VK);
