/*
 * argumentSelect.js — the "choose your argument" screen.
 *
 * Renders 8 category chips. Selecting a chip reveals its 3 pre-written
 * questions plus a custom-question field. The custom field is scoped to the
 * selected category, so a custom question always inherits that category's
 * line bank (decision D7).
 *
 * This module owns no game rules; it just produces a topic object and hands
 * it to the caller via onSelect(topic).
 */
(function (VK) {
  "use strict";

  // topic shape returned to onSelect:
  // {
  //   categoryId: string,
  //   categoryName: string,
  //   lineBank: string,
  //   question: string
  // }

  function mount(container, categories, onSelect) {
    if (!container) {
      console.error("[VK] argumentSelect.mount requires a container element.");
      return function () {};
    }

    var selectedId = null;
    var maxLength = VK.config.customQuestionMaxLength || 140;

    container.innerHTML =
      '<h2 class="screen-title">Choose the argument</h2>' +
      '<p class="screen-hint">Pick a category, then select a question or write your own.</p>' +
      '<div class="category-chips" role="tablist" aria-label="Categories"></div>' +
      '<div class="question-panel" id="question-panel" hidden>' +
      '  <h3 class="category-name" id="selected-category-name"></h3>' +
      '  <div class="question-list" id="question-list" role="radiogroup" aria-label="Questions"></div>' +
      '  <div class="custom-question">' +
      '    <label for="custom-question-input">Or write your own question</label>' +
      '    <textarea id="custom-question-input" rows="2" maxlength="' +
      maxLength +
      '" placeholder="Ask something in this category..."></textarea>' +
      '    <div class="custom-footer">' +
      '      <span id="custom-count" class="char-count">0 / ' +
      maxLength +
      "</span>" +
      '      <button id="custom-confirm" type="button" disabled>Use custom question</button>' +
      "    </div>" +
      "  </div>" +
      "</div>";

    var chips = container.querySelector(".category-chips");
    var panel = container.querySelector("#question-panel");
    var categoryName = container.querySelector("#selected-category-name");
    var questionList = container.querySelector("#question-list");
    var customInput = container.querySelector("#custom-question-input");
    var customCount = container.querySelector("#custom-count");
    var customConfirm = container.querySelector("#custom-confirm");

    function renderChips() {
      chips.innerHTML = "";
      categories.forEach(function (category) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "category-chip";
        chip.setAttribute("role", "tab");
        chip.setAttribute("aria-selected", "false");
        chip.textContent = category.name;
        chip.addEventListener("click", function () {
          selectCategory(category);
        });
        chips.appendChild(chip);
      });
    }

    function selectCategory(category) {
      selectedId = category.id;

      Array.prototype.forEach.call(chips.children, function (chip, index) {
        var isSelected = categories[index].id === category.id;
        chip.classList.toggle("selected", isSelected);
        chip.setAttribute("aria-selected", isSelected ? "true" : "false");
      });

      categoryName.textContent = category.name;
      panel.hidden = false;

      questionList.innerHTML = "";
      category.questions.forEach(function (question, index) {
        var option = document.createElement("button");
        option.type = "button";
        option.className = "question-option";
        option.setAttribute("role", "radio");
        option.setAttribute("aria-checked", "false");
        option.textContent = question;
        option.addEventListener("click", function () {
          chooseQuestion(category, question);
        });
        questionList.appendChild(option);
      });

      customInput.value = "";
      updateCustomCount();
      customConfirm.disabled = true;
      if (questionList.firstChild) questionList.firstChild.focus();
    }

    function chooseQuestion(category, question) {
      Array.prototype.forEach.call(questionList.children, function (child) {
        child.setAttribute("aria-checked", "false");
      });

      var matchIndex = category.questions.indexOf(question);
      if (matchIndex >= 0) {
        questionList.children[matchIndex].setAttribute("aria-checked", "true");
      }

      onSelect(makeTopic(category, question));
    }

    function updateCustomCount() {
      var raw = customInput.value;
      var count = raw.length;
      customCount.textContent = count + " / " + maxLength;
      customConfirm.disabled = VK.sanitize.question(raw).length === 0;
    }

    function confirmCustom() {
      if (!selectedId) return;
      var category = categories.find(function (c) {
        return c.id === selectedId;
      });
      if (!category) return;

      var cleaned = VK.sanitize.question(customInput.value, maxLength);
      if (!cleaned) return;

      onSelect(makeTopic(category, cleaned));
    }

    customInput.addEventListener("input", updateCustomCount);
    customConfirm.addEventListener("click", confirmCustom);

    renderChips();

    return function unmount() {
      container.innerHTML = "";
    };
  }

  function makeTopic(category, question) {
    return {
      categoryId: category.id,
      categoryName: category.name,
      lineBank: category.lineBank,
      question: question,
    };
  }

  VK.argumentSelect = { mount: mount };
})(window.VK);
