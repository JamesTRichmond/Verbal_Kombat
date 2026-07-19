# /docs — design & content

This folder is the home for **design and content work**, kept separate from the
code so the two streams don't collide.

- **Design/content** (this folder): game design doc, fallacy/argument library,
  fighter concepts, balance tables — authored in Markdown.
- **Code** (`/src`, `/index.html`, `/styles`) and **runtime data**
  (`/data/fallacies.json`): the engine and its authoritative content file.

Expected documents (authored separately):

- `GAME_DESIGN.md` — core loop, win/lose, resources, how moves map to combat.
- `fallacies.md` — 15–20 fallacy entries, drafted in a shape that transcribes
  cleanly into `data/fallacies.json` (see `data/README.md` for the schema).
- `FIGHTERS.md` — fighter roster concepts.
- `BALANCE.md` — first-pass damage/risk table and pacing notes.

When content here is ready, it gets transcribed into `data/fallacies.json` and
the tuning numbers feed `src/core/config.js`.
