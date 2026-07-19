/*
 * locationSelect.js — keyboard-navigable arena picker.
 *
 * Presents the arenas loaded from data/locations.json, lets the player pick
 * one with the mouse or keyboard, and reports the chosen location through a
 * callback. Focus management follows roving tabindex so ↑/↓/Enter/Space work
 * like a native listbox.
 */
(function (VK) {
  "use strict";

  function create(container, locations, onSelect) {
    var options = Array.prototype.slice.call(
      container.querySelectorAll(".arena-option")
    );
    var selectedIndex = 0;

    function setFocus(index) {
      options.forEach(function (opt, i) {
        opt.tabIndex = i === index ? 0 : -1;
      });
      options[index].focus();
      selectedIndex = index;
    }

    function selectByIndex(index) {
      var location = findLocation(locations, options[index].dataset.location);
      if (location) onSelect(location);
    }

    options.forEach(function (opt, index) {
      opt.addEventListener("click", function () {
        selectByIndex(index);
      });
      opt.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          setFocus((index + 1) % options.length);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          setFocus((index - 1 + options.length) % options.length);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectByIndex(index);
        }
      });
    });

    return {
      focus: function () { setFocus(selectedIndex); },
    };
  }

  function findLocation(locations, id) {
    for (var i = 0; i < locations.length; i++) {
      if (locations[i].id === id) return locations[i];
    }
    console.warn("[VK] Unknown location id '" + id + "'; defaulting to first arena.");
    return locations[0] || null;
  }

  VK.locationSelect = { create: create };
})(window.VK);
