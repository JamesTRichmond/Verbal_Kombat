# Content data

Authoritative content files the engine loads at runtime. Each file is the one
source of truth for its schema; design/content drafts (authored under `/docs`)
get transcribed into these shapes.

Pivot content (Release 1 — "The Fight Writes", see `docs/DESIGN-v2.md`):

| File | Loaded by | What it holds |
|---|---|---|
| `topics.json` | `src/engine/contentLoader.js` | 8 argument categories × 3 questions, plus per-category vocab |
| `fighters.json` | `src/engine/contentLoader.js` | The 4-fighter roster: stats, style, special, CPU behavior |
| `locations.json` | `src/engine/contentLoader.js` | The 2 arenas: palette, parallax, scripted environmental event |
| `lines/<bank>.json` | `src/engine/contentLoader.js` | Per-fighter dialogue template banks keyed by ledger event type |
| `fallacies.json` | `src/engine/dataLoader.js` | Canvas-prototype argument content (pre-pivot) |

All loading follows the same fallback pattern: fetch the JSON, and if fetch is
unavailable (e.g. `file://`) fall back to a small built-in set so the game
still boots. Serve locally (`npm start`) for full content.

## `topics.json`

```jsonc
{
  "version": 1,
  "categories": [
    {
      "id": "food",              // snake_case, unique, stable
      "label": "Food",           // category chip text
      "questions": [             // exactly 3 pre-written questions per category
        { "id": "pineapple_pizza", "text": "Does pineapple belong on pizza?" }
      ],
      "vocab": {                 // interpolated into dialogue templates
        "stanceFor": "...",      // the affirmative framing
        "stanceAgainst": "...",  // the negative framing
        "evidence": "...",       // a category-flavored piece of evidence
        "expert": "..."          // a category-flavored authority
      }
    }
  ]
}
```

**Custom questions** are player-typed free text entered *within a selected
category* (decision D7) — they inherit that category's vocab and line banks.
Custom input must pass through `VK.content.sanitizeCustomQuestion()` (strips
markup and control characters, collapses whitespace, caps at
`config.content.maxCustomQuestionLength`) before it enters match state, and is
only ever rendered via canvas `fillText` or DOM `textContent`, never
`innerHTML`.

## `fighters.json`

```jsonc
{
  "version": 1,
  "fighters": [
    {
      "id": "logician",           // snake_case, unique, stable
      "name": "The Logician",
      "tagline": "...",           // one-liner for the identity panel
      "style": {
        "argument": "...",        // how they argue (identity panel)
        "combat": "..."           // how that maps to combat (identity panel)
      },
      "stats": { "power": 5, "speed": 7 },   // integers 1–10, shown on select
      "special": {
        "id": "syllogism",
        "name": "The Syllogism",  // the named special on the identity panel
        "description": "..."
      },
      "lineBank": "logician",     // key into data/lines/<key>.json
      "cpu": {                    // scripted behavior per decision D10
        "aggressionCurve": [      // piecewise curve over the round, in ticks
          { "untilTick": 1200, "aggression": 0.25 }   // aggression 0..1
        ],
        "punishWindowTicks": 18,  // how long after your whiff the CPU punishes
        "blockBias": 0.6,         // 0..1 tendency to block under pressure
        "preferredRange": "mid"   // "close" | "mid" | "far"
      }
    }
  ]
}
```

All timing is in **simulation ticks** (fixed timestep, 60/s — decision D11),
never wall-clock milliseconds.

## `locations.json`

```jsonc
{
  "version": 1,
  "locations": [
    {
      "id": "forum",
      "name": "The Forum",
      "description": "...",
      "palette": { "sky": "#...", "backdrop": "#...", "floor": "#...", "accent": "#..." },
      "parallaxLayers": ["colonnade", "crowd", "dais"],   // back-to-front
      "event": {                  // the one scripted environmental event (R1)
        "id": "echo",
        "name": "The Echo",
        "trigger": { "atTick": 1800 },
        "effect": {
          // "dialogue_weight": multiply the dialogue weight of a target event
          //   { "type": "dialogue_weight", "target": "next_landed_point", "multiplier": 2 }
          // "event_weight_bonus": add judge weight to an event type for a window
          //   { "type": "event_weight_bonus", "eventType": "counter", "bonus": 2, "durationTicks": 600 }
          "type": "dialogue_weight",
          "target": "next_landed_point",
          "multiplier": 2
        },
        "announcement": "..."     // ticker line when the event fires (it is
                                  // itself a ledger event)
      }
    }
  ]
}
```

## `lines/<bank>.json` — dialogue template banks

```jsonc
{
  "version": 1,
  "fighter": "logician",          // must match the filename / lineBank key
  "events": {                     // every ledger event type must be present
    "lightHit":  ["...", "..."],  // advance a point
    "heavyHit":  ["..."],         // press a point hard
    "combo":     ["..."],         // a developed multi-clause argument
    "special":   ["..."],         // the fighter's signature rhetorical technique
    "whiff":     ["..."],         // a stumble the opponent can verbally punish
    "blocked":   ["..."],         // the opponent absorbed the point
    "counter":   ["..."],         // a direct rebuttal
    "victory":   ["..."],
    "defeat":    ["..."]
  },
  "categoryOverrides": {          // optional: full per-category replacements
    "philosophy": { "special": ["..."] }
  }
}
```

Templates may use the placeholders `{topic}`, `{opponent}` (filled from match
state) and `{stanceFor}`, `{stanceAgainst}`, `{evidence}`, `{expert}` (filled
from the topic category's `vocab`). Lookup semantics
(`VK.content.linesFor(bank, categoryId, eventType)`): a category override wins
when present, otherwise the base `events` bank applies — so every fighter has
per-category dialogue for all 8 categories via vocab interpolation, and
categories can be given fully bespoke lines incrementally. Combo/special lines
should read visibly more developed than jab lines (dialogue-engine AC). Keep
the tone stylized and playful, not hateful.

Validation: `npm test` runs `data.test.mjs`, which checks all of the above
shapes, cross-references (lineBank keys → files, override category ids →
topics), and placeholder usage.

---

# Canvas-prototype content — `fallacies.json`

## Schema

```jsonc
{
  "version": 1,               // bump when the shape changes
  "fallacies": [
    {
      "id": "straw_man",      // stable, unique, snake_case — never rename in place
      "name": "Straw Man",    // display name
      "description": "...",   // one line: what the fallacy is
      "example": "...",       // in-game "attack" line the fighter delivers
      "counter": "...",       // the rebuttal that beats it (defender's line)
      "damage": 6,            // 1–10: hit landed on the opponent
      "risk": 5               // 1–10: how exposed you are to a counter after
    }
  ]
}
```

### Field rules

- **`id`** — snake_case, unique, stable. Combat and future save data reference
  it, so treat it as permanent once shipped.
- **`damage` / `risk`** — integers 1–10. Higher `damage` should generally carry
  higher `risk`; balance lives in `src/core/config.js` and `/docs/BALANCE.md`.
- **`example` / `counter`** — keep the tone stylized and playful, not hateful.
- Add new entries by appending to the `fallacies` array. No code change needed —
  the engine picks up everything in the file.

## How it's loaded

`src/engine/dataLoader.js` fetches this file. Opening `index.html` directly from
disk works in most browsers, but some (e.g. Chrome) block `fetch` on `file://`.
In that case the game falls back to a tiny built-in demo set and prints a note
in the console. To load the full file, serve locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
