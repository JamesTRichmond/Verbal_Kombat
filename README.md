# VerbalKombat

A fighting game where the attacks are performed through sound arguments
and logic. Land a valid argument and you draw blood; commit a fallacy and you
leave yourself open to a counter.

There are currently two prototypes in this repository: an HTML5 Canvas game and a Text-based game.

---

## 1. Canvas Prototype (index.html)

Built as a **dependency-free web/HTML5** app — vanilla JavaScript + the Canvas API, no build step.

### Run it

You can simply open `index.html` in a browser to play. 

*(Note: Some browsers block `fetch` on `file://`, so the game falls back to a small built-in argument set. To load the full `data/fallacies.json`, run `npm start` to start a local server and go to `http://localhost:8000/`)*

### Controls

- **1–4** — throw the matching argument
- **Space** — start / rematch

### Project layout

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

---

## 2. Text Prototype (text-version.html)

A text-based prototype of the game is also available (Release 1).

Included: one player, one scripted opponent, one prompt, text input, transparent scoring, health, damage, a verdict, replay, and a responsive accessible interface.

### Run it

Run `npm start`, then open http://localhost:8000/text-version.html. 
Run `npm test` to verify scoring.
