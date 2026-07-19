/*
 * screens.js — DOM rendering for the five-screen flow.
 *
 * Renders whatever screen VK.screenFlow says is current and reports the
 * player's choices back to it. Placeholder-quality visuals (the dedicated
 * screen issues flesh them out), but the controls are real: every interactive
 * element is a native <button> or <input> (keyboard-reachable, visible
 * :focus-visible outline), Escape walks back, and focus moves to the screen
 * heading on every transition.
 *
 * All player-facing text lands via textContent — never innerHTML — per the
 * custom-question safety rule in data/README.md.
 */
(function (VK) {
  "use strict";

  // init({ flow, content, fight }) — fight is { start(setup), stop() },
  // provided by main.js to run the canvas game while the fight screen is up.
  function init(deps) {
    var flow = deps.flow;
    var content = deps.content;
    var fight = deps.fight;
    var root = document.getElementById("screens");
    var selectedCategory = null;
    var selectedFighter = null;

    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function button(label, className, onClick) {
      var b = el("button", className, label);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    }

    function section(title, subtitle) {
      var s = el("section", "screen");
      var h = el("h2", "screen-title", title);
      h.tabIndex = -1;
      s.appendChild(h);
      if (subtitle) s.appendChild(el("p", "screen-subtitle", subtitle));
      return { node: s, heading: h };
    }

    function backButton() {
      return button("← Back", "back-button", function () {
        flow.back();
      });
    }

    function fighterById(id) {
      for (var i = 0; i < content.fighters.length; i++) {
        if (content.fighters[i].id === id) return content.fighters[i];
      }
      return null;
    }

    // ---- argument select ----
    function renderArgument() {
      var s = section("Choose the argument", "Pick a category, then the question the fight will settle.");
      var chips = el("div", "chip-row");
      chips.setAttribute("role", "group");
      chips.setAttribute("aria-label", "Argument categories");
      var detail = el("div", "argument-detail");

      content.topics.forEach(function (category) {
        var chip = button(category.label, "chip", function () {
          selectedCategory = category;
          chips.querySelectorAll(".chip").forEach(function (c) {
            c.setAttribute("aria-pressed", String(c === chip));
          });
          renderQuestions(detail, category);
        });
        chip.setAttribute("aria-pressed", "false");
        chips.appendChild(chip);
      });

      s.node.appendChild(chips);
      s.node.appendChild(detail);
      return s;
    }

    function renderQuestions(detail, category) {
      detail.textContent = "";
      var list = el("div", "question-list");
      category.questions.forEach(function (q) {
        list.appendChild(
          button(q.text, "question", function () {
            flow.selectArgument({
              categoryId: category.id,
              questionId: q.id,
              questionText: q.text,
            });
          })
        );
      });
      detail.appendChild(list);

      var form = el("form", "custom-question");
      var label = el("label", null, "Or ask your own (" + category.label + "):");
      var input = el("input");
      input.type = "text";
      input.maxLength = 140;
      input.placeholder = "Type a question…";
      label.appendChild(input);
      var go = el("button", "question custom-go", "Argue it");
      go.type = "submit";
      form.appendChild(label);
      form.appendChild(go);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var clean = VK.content.sanitizeCustomQuestion(input.value);
        if (!clean) {
          input.focus();
          return;
        }
        flow.selectArgument({
          categoryId: category.id,
          questionText: clean,
          isCustom: true,
        });
      });
      detail.appendChild(form);
    }

    // ---- fighter select ----
    function renderFighter() {
      var s = section("Choose your fighter", "Style is how you argue. The CPU takes another fighter.");
      var layout = el("div", "select-layout");
      var grid = el("div", "roster-grid");
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", "Fighter roster");
      var panel = el("div", "identity-panel");
      panel.appendChild(el("p", "panel-hint", "Select a fighter to see their style."));

      content.fighters.forEach(function (f) {
        var card = button(f.name, "roster-card", function () {
          selectedFighter = f;
          grid.querySelectorAll(".roster-card").forEach(function (c) {
            c.setAttribute("aria-pressed", String(c === card));
          });
          renderIdentity(panel, f);
        });
        card.setAttribute("aria-pressed", "false");
        grid.appendChild(card);
      });

      layout.appendChild(grid);
      layout.appendChild(panel);
      s.node.appendChild(layout);
      s.node.appendChild(backButton());
      return s;
    }

    function renderIdentity(panel, f) {
      panel.textContent = "";
      panel.appendChild(el("h3", "panel-name", f.name));
      panel.appendChild(el("p", "panel-tagline", "“" + f.tagline + "”"));
      panel.appendChild(el("p", null, f.style.argument));
      panel.appendChild(el("p", null, f.style.combat));
      panel.appendChild(
        el("p", "panel-stats", "Power " + f.stats.power + " · Speed " + f.stats.speed)
      );
      panel.appendChild(el("p", "panel-special", "Special: " + f.special.name + " — " + f.special.description));

      var opponent = pickOpponent(f);
      panel.appendChild(el("p", "panel-opponent", "Opponent: " + opponent.name + " (CPU)"));
      panel.appendChild(
        button("Fight as " + f.name, "confirm", function () {
          flow.selectFighter({ fighterId: f.id, opponentId: opponent.id });
        })
      );
    }

    // Auto-assigned CPU opponent for now: the next fighter in the roster.
    // Issue #11 adds player choice.
    function pickOpponent(f) {
      var i = content.fighters.indexOf(f);
      return content.fighters[(i + 1) % content.fighters.length];
    }

    // ---- location select ----
    function renderLocation() {
      var s = section("Choose the venue", "Where the argument happens shapes how it lands.");
      var row = el("div", "arena-row");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "Venues");
      content.locations.forEach(function (loc) {
        var card = button("", "arena-card", function () {
          flow.selectLocation({ locationId: loc.id });
        });
        card.appendChild(el("span", "arena-name", loc.name));
        card.appendChild(el("span", "arena-desc", loc.description));
        card.style.background =
          "linear-gradient(" + loc.palette.sky + ", " + loc.palette.floor + ")";
        row.appendChild(card);
      });
      s.node.appendChild(row);
      s.node.appendChild(backButton());
      return s;
    }

    // ---- fight ----
    function renderFight(setup) {
      var s = section("The fight");
      var topic = setup.topic ? setup.topic.questionText : "";
      var you = fighterById(setup.fighter);
      var them = fighterById(setup.opponent);
      s.node.appendChild(
        el(
          "p",
          "matchup",
          (you ? you.name : "?") +
            " vs " +
            (them ? them.name : "?") +
            " — “" + topic + "”"
        )
      );

      var stage = document.getElementById("stage");
      s.node.appendChild(stage);
      stage.hidden = false;

      s.node.appendChild(
        el(
          "p",
          "screen-subtitle",
          "Placeholder combat (the scaffold game) until the real combat core lands. 1–4 throw arguments, Space starts."
        )
      );

      var controls = el("div", "fight-controls");
      controls.appendChild(
        button("Conclude the round → verdict", "confirm", function () {
          flow.finishFight({ placeholder: true });
        })
      );
      controls.appendChild(backButton());
      s.node.appendChild(controls);
      return s;
    }

    // ---- verdict ----
    function renderVerdict(setup) {
      var s = section("The verdict", "Placeholder judge board — the selections below survived the whole flow.");
      var card = el("dl", "verdict-card");
      function row(label, value) {
        card.appendChild(el("dt", null, label));
        card.appendChild(el("dd", null, value));
      }
      var you = fighterById(setup.fighter);
      var them = fighterById(setup.opponent);
      row("Question", setup.topic ? setup.topic.questionText : "—");
      row(
        "Category",
        setup.topic ? setup.topic.categoryId + (setup.topic.isCustom ? " (custom question)" : "") : "—"
      );
      row("You argued as", you ? you.name : "—");
      row("Against", them ? them.name : "—");
      row("Venue", setup.location || "—");
      row("Result", setup.result ? "round concluded (placeholder)" : "—");
      s.node.appendChild(card);
      s.node.appendChild(
        button("New argument", "confirm", function () {
          flow.reset();
        })
      );
      return s;
    }

    // ---- screen switching ----
    var stageParkingLot = el("div");
    stageParkingLot.hidden = true;
    stageParkingLot.id = "stage-parking";
    document.body.appendChild(stageParkingLot);

    function render(screen, setup) {
      // The canvas outlives re-renders: park it before wiping the container.
      var stage = document.getElementById("stage");
      if (stage) {
        stageParkingLot.appendChild(stage);
        stage.hidden = true;
      }
      if (screen !== "fight") fight.stop();

      root.textContent = "";
      selectedFighter = null;
      if (screen !== "argument") selectedCategory = null;

      var built;
      if (screen === "argument") built = renderArgument();
      else if (screen === "fighter") built = renderFighter();
      else if (screen === "location") built = renderLocation();
      else if (screen === "fight") built = renderFight(setup);
      else built = renderVerdict(setup);

      root.appendChild(built.node);
      built.heading.focus();

      if (screen === "fight") fight.start(setup);
    }

    // Escape walks back anywhere it's meaningful (not while typing).
    window.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      flow.back();
    });

    render(flow.getScreen(), flow.getSetup());
    return { render: render };
  }

  VK.screens = { init: init };
})(window.VK);
