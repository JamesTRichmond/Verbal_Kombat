# CLAUDE.md

Guidance for Claude (and any AI assistant) working in this repo. Read this
before making changes so the two work streams stay aligned.

## What this is

**Verbal Kombat** — a browser fighting game where attacks are arguments and
logic. Landing a sound argument deals damage; committing a logical fallacy
leaves you exposed to a counter.

## Tech stack — non-negotiable

- **Vanilla JavaScript + HTML5 Canvas.** No frameworks, no bundlers, no npm
  dependencies, **no build step**.
- Must run by **opening `index.html`** directly in a browser. Some browsers
  block `fetch` on `file://`, so keep the graceful fallback in
  `dataLoader.js` working; for the full data file, serve locally
  (`python3 -m http.server`).
- Target modern browsers. Classic `<script>` tags (not ES modules) so the game
  loads from `file://` — everything hangs off the global `VK` namespace.

## Architecture & boundaries

Keep concerns separated. Don't collapse these layers.

- **Content is data** — arguments/fallacies live in `data/fallacies.json`
  (the source of truth). Add moves by editing data, not code. Schema is
  documented in `data/README.md`; keep it and the JSON in sync.
- **Rules are pure** — `src/engine/combat.js` has no DOM/canvas/timers. Keep it
  that way so combat stays testable and tunable in isolation.
- **Rendering is read-only over state** — `src/render/renderer.js` draws; it
  never mutates state. Swap primitives for real art without touching engine
  logic.
- **The loop only sequences** — `src/engine/gameLoop.js` computes dt and calls
  `update()` then `draw()`. No rules, no drawing.
- **Balance is centralized** — tuning numbers go in `src/core/config.js`, not
  scattered through the engine.
- **`main.js` is the only cross-cutting file** — it wires data + canvas + input
  + loop. Everything else stays in its lane.

## Work-stream split (important)

Two streams, deliberately kept off each other's files:

- **Code + runtime data** (`/index.html`, `/styles`, `/src`, `/data`) — the
  engine and its authoritative content file. **Claude owns this.**
- **Design & content** (`/docs`) — game design doc, expanded fallacy library,
  fighter concepts, balance tables, authored in Markdown (this is the
  Copilot Space stream). See `docs/README.md`.

When `/docs` content is ready, it gets **transcribed** into
`data/fallacies.json` (following the schema) and its tuning numbers feed
`src/core/config.js`. Do not have code work and docs work edit the same files.

## Conventions

- Match the surrounding style: concise comments explaining *why*, not *what*.
- `fallacy.id` is snake_case, unique, and **stable** — never rename in place;
  combat and future save data reference it.
- `damage` / `risk` are integers 1–10; higher damage should carry higher risk.
- Keep "attack" content stylized and playful — the "bloody" theme is tone, not
  an excuse for hateful content.
- Prefer focused, incremental changes. Ask before large refactors or
  architecture changes.

## Verifying changes

No test framework is set up (deliberately dependency-free). Before committing:

- `node --check <file>` on any changed `.js`.
- `node -e "JSON.parse(require('fs').readFileSync('data/fallacies.json','utf8'))"`
  to confirm the data parses.
- For engine changes, a quick headless smoke test that drives a match to a KO
  (load the pure `VK` modules under a `global.window` shim) catches runtime
  errors without a browser.

## Layout

```
index.html            Entry point; loads scripts in dependency order
styles/main.css       Presentation only
src/core/             namespace.js, config.js (balance constants)
src/engine/           dataLoader, combat (pure rules), state, input, gameLoop
src/render/           renderer.js (draws state; never mutates it)
src/main.js           Boot: wires it all together
data/fallacies.json   Authoritative content (source of truth)
data/README.md        Content schema
docs/                 Design & content docs (separate stream)
```
