# VerbalKombat

A bloody fighting game where the attacks are performed through sound arguments
and logic. Land a valid argument and you draw blood; commit a fallacy and you
leave yourself open to a counter.

Built as a dependency-free **web/HTML5** app — vanilla JavaScript + the Canvas
API, no build step.

## Run it

Just open `index.html` in a browser.

Some browsers (e.g. Chrome) block `fetch` on `file://`, so the game falls back
to a small built-in argument set when opened directly. To load the full
`data/fallacies.json`, serve locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Controls

- **1–5** — throw the argument in that slot on the current page
- **Q / E** (or ← / →) — page through the full roster of arguments
- **F** — rebut the enemy's incoming argument (time it inside the window to counter)
- **Space** — start / rematch

The full roster is shown a page at a time (page size is set by
`moves.pageSize` in `src/core/config.js`); cycle pages to reach every argument.

Matches are **best of 3**. Land sound arguments, manage your composure, and
call out the enemy's telegraphed fallacies to riposte them.

## Project layout

```
index.html            Entry point; loads scripts in dependency order
styles/main.css       Presentation only
src/
  core/
    namespace.js      Global VK namespace
    config.js         Tunable constants (balance lives here)
  engine/
    dataLoader.js     Loads data/fallacies.json (with fallback)
    combat.js         Pure combat rules — no DOM/canvas
    state.js          Game model + update tick
    input.js          Keyboard -> intent
    gameLoop.js       requestAnimationFrame heartbeat
  render/
    renderer.js       Draws state to the canvas (read-only)
  main.js             Boot: wires it all together
data/
  fallacies.json      Authoritative content (source of truth)
  README.md           Content schema
docs/                 Design & content docs (separate stream)
```

## How it fits together

Clear separation of concerns keeps things easy to extend:

- **Content** is data (`data/fallacies.json`) — add arguments without touching code.
- **Rules** are pure (`src/engine/combat.js`) — easy to reason about and tune.
- **Rendering** reads state and never mutates it — swap primitives for art freely.
- **Balance** is centralized (`src/core/config.js`).

Design and content are authored under `/docs` (see `docs/README.md`) and feed
the data and config files.
