/*
 * htmlEscape.js — minimal XSS-safe escaping for untrusted text.
 *
 * Use this for any user-provided string that may be rendered as HTML,
 * such as custom topic input. It escapes the five characters that matter
 * for text content and attribute contexts; it does not sanitize URLs or
 * allow markup.
 */
(function (VK) {
  "use strict";

  var REPLACEMENTS = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  var PATTERN = /[&<>"']/g;

  VK.htmlEscape = function htmlEscape(text) {
    if (text == null) return "";
    return String(text).replace(PATTERN, function (ch) {
      return REPLACEMENTS[ch];
    });
  };
})(window.VK);
