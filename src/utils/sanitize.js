/*
 * sanitize.js — small, dependency-free helpers for player-authored text.
 *
 * Used for the custom-question field on the argument-selection screen.
 * All escaping is explicit; UI code should prefer textContent and only call
 * escapeHtml when it genuinely needs to set innerHTML.
 */
(function (VK) {
  "use strict";

  function cleanQuestion(text, maxLength) {
    if (typeof text !== "string") return "";
    var limit = typeof maxLength === "number" && maxLength > 0
      ? maxLength
      : VK.config.customQuestionMaxLength || 140;

    return text
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, limit);
  }

  function escapeHtml(text) {
    if (typeof text !== "string") return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  VK.sanitize = {
    question: cleanQuestion,
    escapeHtml: escapeHtml,
  };
})(window.VK);
