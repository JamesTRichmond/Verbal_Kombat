# VerbalKombat

A fighting game where the attacks are performed through sound arguments
and logic. Land a valid argument and you draw blood; commit a fallacy and you
leave yourself open to a counter.

Built as a **web/HTML5** app — vanilla JavaScript + the Canvas
API.

## Run it

```bash
npm start
# then open http://localhost:8000
```
*(Node is used to serve the files locally to avoid CORS errors when loading `data/fallacies.json`)*

## Controls

- **1–4** — throw the matching argument
- **Space** — start / rematch

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

---

## Release 1: Text Prototype

A text-based prototype of the game is also available.

Included: one player, one scripted opponent, one prompt, text input, transparent scoring, health, damage, a verdict, replay, and a responsive accessible interface.

**Run the text prototype:**
`npm start`, then open http://localhost:8000/text-version.html. Run `npm test` to verify scoring.
