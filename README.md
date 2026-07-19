# VerbalKombat

VerbalKombat is a fighting game where attacks are performed through sound arguments and logic.

The project is pivoting from a typed-argument prototype to a real-time fighting game that writes the argument from how you fight. The current Release 1 — "The Fight Writes" — is specified in [docs/DESIGN-v2.md](docs/DESIGN-v2.md) and tracked in issues #7–#18.

## Documentation

- [Design v2](docs/DESIGN-v2.md) — **the authoritative spec** for the fighting-game pivot: vision, smallest playable loop, and the Release 1 plan.
- [Design decisions](docs/DECISIONS.md) — the reasoning log; D6–D13 cover the pivot (combat scope, ledger architecture, determinism, and more).
- [Contributing guide](CONTRIBUTING.md) — local setup, testing, branch/PR expectations, and the Release 1 scope boundary.
- [Architecture](docs/ARCHITECTURE.md) — describes the retired text prototype ("Classic mode"); its static-app constraints still apply to the pivot.

There are currently two prototypes in this repository: an HTML5 Canvas game (the pivot's foundation) and the retired text game (Classic mode).

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

## 2. Classic Mode — Text Prototype (text-version.html)

The original typed-argument prototype (formerly "Release 1") is retired from the main flow but kept playable as Classic mode (decision D9).

Included: one player, one scripted opponent, one prompt, text input, transparent scoring, health, damage, a verdict, replay, and a responsive accessible interface.

### Run it

Run `npm start`, then open http://localhost:8000/text-version.html. 
Run `npm test` to verify scoring.
