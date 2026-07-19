/*
 * ticker.js — throttled bottom-ticker for earned dialogue lines.
 *
 * The ticker owns a queue of pending lines and exposes one line at a time.
 * It advances no more than one line per displayInterval seconds. When the
 * queue exceeds a safety cap, older undisplayed lines are dropped so the
 * ticker never backs up and obstructs combat.
 */
(function (VK) {
  "use strict";

  var DEFAULT_INTERVAL = 2.5;
  var DEFAULT_MAX_QUEUE = 8;

  function create(interval, maxQueue) {
    interval = interval || DEFAULT_INTERVAL;
    maxQueue = typeof maxQueue === "number" ? maxQueue : DEFAULT_MAX_QUEUE;

    return {
      queue: [],          // pending lines waiting to be shown
      current: null,      // line currently on display
      timer: interval,    // seconds remaining before next advance
      interval: interval,
      maxQueue: maxQueue,
    };
  }

  function enqueue(ticker, line) {
    if (!line || !line.text) return;
    // Drop oldest entries if the queue is backing up; combat is the priority.
    if (ticker.queue.length >= ticker.maxQueue) {
      ticker.queue.shift();
    }
    ticker.queue.push(line);
  }

  function update(ticker, dt) {
    ticker.timer -= dt;
    if (ticker.timer <= 0) {
      // Move the next queued line into the display slot.
      if (ticker.queue.length > 0) {
        ticker.current = ticker.queue.shift();
      }
      // If nothing is queued, keep showing the current line; reset the timer
      // so we don't thrash.
      ticker.timer = ticker.interval;
    }
  }

  function currentLine(ticker) {
    return ticker.current;
  }

  function pendingCount(ticker) {
    return ticker.queue.length;
  }

  VK.ticker = {
    create: create,
    enqueue: enqueue,
    update: update,
    currentLine: currentLine,
    pendingCount: pendingCount,
  };
})(window.VK);
