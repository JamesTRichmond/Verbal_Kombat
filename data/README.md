# Content data

This directory holds the authoritative content files the engine loads at runtime.
Each file is the one source of truth for its schema; design/content drafts
(authored under `/docs`) get transcribed into this shape.

## `fallacies.json`

Argument moves used during combat.

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

## `fighters.json`

The roster of original fighters. Each fighter maps an argumentative style to a
combat style and carries the identity shown on the fighter selection screen.

## Schema

```jsonc
{
  "version": 1,
  "fighters": [
    {
      "id": "logician",          // stable, unique, snake_case
      "name": "The Logician",    // display name
      "style": "Precise, counter-focused",
      "description": "...",      // one-paragraph style description
      "portrait": "Λ",           // text-only portrait stand-in
      "stats": [                  // exactly two visible stats, 1-10
        { "label": "Precision", "value": 8 },
        { "label": "Composure", "value": 7 }
      ],
      "special": {               // one named special ability
        "name": "Socratic Cross-exam",
        "description": "..."
      }
    }
  ]
}
```

### Field rules

- **`id`** — snake_case, unique, stable. Save data and ledger headers reference
  it.
- **`stats`** — exactly two entries. `value` is an integer 1–10.
- **`special`** — a single named ability that expresses the fighter's
  argumentative/combat style.
- **`portrait`** — a temporary text glyph until original art is added.

Load order and fallback mirror `fallacies.json`: fetched at runtime, with a
built-in fallback in `src/engine/fighterLoader.js` so the game still runs when
opened directly from disk.
