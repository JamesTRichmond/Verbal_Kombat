/*
 * screens.js — DOM-based selection and verdict screens.
 *
 * Builds the Argument → Fighter → Location flow and the final verdict,
 * reading setup data and the match ledger. It manipulates a single app
 * container; the canvas fight screen lives in renderer.js.
 */
(function (VK) {
  "use strict";

  function create(container, callbacks) {
    var currentCategory = null;

    function clear() {
      container.innerHTML = "";
    }

    function header() {
      var h = document.createElement("header");
      h.id = "hud";
      h.innerHTML = '<h1 class="title">VERBAL&nbsp;<span class="accent">KOMBAT</span></h1><p class="tagline">Win the argument. Draw blood.</p>';
      return h;
    }

    function el(tag, cls, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function focusFirst(containerNode) {
      var first = containerNode.querySelector("button, input, select, a, [tabindex]:not([tabindex='-1'])");
      if (first) first.focus();
    }

    function showTopic(data, selections) {
      clear();
      var wrapper = el("div", "screen");
      wrapper.appendChild(header());
      var main = el("main", "screen-body");
      main.appendChild(el("h2", "screen-title", "Choose the argument"));

      var catRow = el("div", "chip-row");
      data.topics.forEach(function (cat) {
        var btn = el("button", "chip", cat.name);
        btn.dataset.id = cat.id;
        btn.addEventListener("click", function () {
          currentCategory = cat;
          renderQuestions(main, cat, selections);
        });
        catRow.appendChild(btn);
      });
      main.appendChild(catRow);

      var questionPanel = el("div", "question-panel");
      main.appendChild(questionPanel);
      wrapper.appendChild(main);
      container.appendChild(wrapper);
      focusFirst(wrapper);

      function renderQuestions(panel, category, selections) {
        questionPanel.innerHTML = "";
        var title = el("h3", "", category.name);
        questionPanel.appendChild(title);
        category.questions.forEach(function (q, i) {
          var qBtn = el("button", "question-button", (i + 1) + ". " + q);
          qBtn.addEventListener("click", function () {
            selections.topic = { category: category.id, text: q, bank: category.bank };
            callbacks.onTopicSelected();
          });
          questionPanel.appendChild(qBtn);
        });
        var custom = el("div", "custom-row");
        var input = el("input", "custom-input");
        input.type = "text";
        input.placeholder = "Or write your own question in " + category.name.toLowerCase() + "...";
        input.maxLength = 140;
        var submit = el("button", "primary-button", "Use custom");
        submit.addEventListener("click", function () {
          var text = input.value.trim();
          if (!text) return input.focus();
          selections.topic = { category: category.id, text: text, bank: category.bank };
          callbacks.onTopicSelected();
        });
        custom.appendChild(input);
        custom.appendChild(submit);
        questionPanel.appendChild(custom);
        input.focus();
      }
    }

    function showFighter(data, selections) {
      clear();
      var wrapper = el("div", "screen");
      wrapper.appendChild(header());
      var main = el("main", "screen-body");
      main.appendChild(el("h2", "screen-title", "Choose your fighter"));

      var grid = el("div", "fighter-grid");
      var detail = el("div", "fighter-detail");

      data.fighters.forEach(function (f) {
        var btn = el("button", "fighter-card");
        btn.appendChild(el("span", "fighter-card-name", f.name));
        btn.addEventListener("click", function () {
          renderDetail(f);
        });
        grid.appendChild(btn);
      });

      function renderDetail(f) {
        detail.innerHTML = "";
        detail.appendChild(el("h3", "fighter-name", f.name));
        detail.appendChild(el("p", "fighter-style", f.style));
        detail.appendChild(el("p", "fighter-stats", "Precision " + f.stats.precision + " · Pressure " + f.stats.pressure));
        detail.appendChild(el("p", "fighter-special", "Special — " + f.special));
        var choose = el("button", "primary-button", "Fight as " + f.name);
        choose.addEventListener("click", function () {
          selections.playerFighter = f;
          selections.enemyFighter = data.fighters.find(function (x) { return x.id !== f.id; }) || data.fighters[0];
          callbacks.onFighterSelected();
        });
        detail.appendChild(choose);
      }

      main.appendChild(grid);
      main.appendChild(detail);
      wrapper.appendChild(main);
      container.appendChild(wrapper);
      renderDetail(data.fighters[0]);
      focusFirst(wrapper);
    }

    function showLocation(data, selections) {
      clear();
      var wrapper = el("div", "screen");
      wrapper.appendChild(header());
      var main = el("main", "screen-body");
      main.appendChild(el("h2", "screen-title", "Choose the arena"));

      var grid = el("div", "location-grid");
      data.locations.forEach(function (loc) {
        var card = el("button", "location-card");
        card.appendChild(el("span", "location-name", loc.name));
        card.appendChild(el("span", "location-event", loc.event.name));
        card.appendChild(el("span", "location-desc", loc.event.description));
        card.addEventListener("click", function () {
          selections.location = loc;
          callbacks.onLocationSelected();
        });
        grid.appendChild(card);
      });

      main.appendChild(grid);
      wrapper.appendChild(main);
      container.appendChild(wrapper);
      focusFirst(wrapper);
    }

    function showVerdict(state) {
      clear();
      var wrapper = el("div", "screen");
      wrapper.appendChild(header());
      var main = el("main", "screen-body verdict-body");

      var result = (state.verdict && state.verdict.verdict) || { label: "MATCH COMPLETE", winner: null, average: 0 };
      main.appendChild(el("h2", "verdict-title", result.label));
      main.appendChild(el("p", "verdict-average", "Judge average: " + result.average + "/100"));

      var board = el("div", "judge-board");
      var scores = (state.verdict && state.verdict.judges) || [];
      scores.forEach(function (judge) {
        var card = el("div", "judge-card");
        card.appendChild(el("h3", "judge-name", judge.name + ": " + judge.score + "/100"));
        card.appendChild(el("p", "judge-quote", judge.quote));
        if (judge.moments && judge.moments.length) {
          var list = el("ul", "judge-moments");
          judge.moments.forEach(function (m) {
            list.appendChild(el("li", "", m.message));
          });
          card.appendChild(list);
        }
        board.appendChild(card);
      });

      main.appendChild(board);
      var restart = el("button", "primary-button", "Fight again");
      restart.addEventListener("click", callbacks.onRestart);
      main.appendChild(restart);
      wrapper.appendChild(main);
      container.appendChild(wrapper);
      focusFirst(wrapper);
    }

    return {
      showTopic: showTopic,
      showFighter: showFighter,
      showLocation: showLocation,
      showVerdict: showVerdict,
      clear: clear,
    };
  }

  VK.screens = { create: create };
})(window.VK);
