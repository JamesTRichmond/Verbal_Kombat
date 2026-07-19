# Content data — `fallacies.json`

This is the **authoritative content file** the engine loads at runtime. It's the
one source of truth for the schema; design/content drafts (authored under
`/docs`) get transcribed into this shape.

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

## `topics.json`

Argument categories and seed questions for the selection screen. Custom
questions are entered inside a selected category and inherit its `lineBank`
key, per decision D7.

### Schema

```jsonc
{
  "version": 1,
  "categories": [
    {
      "id": "ethics",           // snake_case, unique, stable
      "name": "Ethics",         // display label for the category chip
      "lineBank": "ethics",     // key into the per-category dialogue template bank
      "questions": [            // exactly three pre-written questions per category
        "Is it ever okay to tell a white lie?",
        "...",
        "..."
      ]
    }
  ]
}
```

### Field rules

- **`id`** — snake_case, unique, stable. Referenced by the match ledger and
  save data, so treat it as permanent once shipped.
- **`name`** — short, player-facing category label (one or two words).
- **`lineBank`** — matches the key used by the dialogue engine for that
  category's template bank. For custom questions this is inherited from the
  selected category; there is no category-less custom path.
- **`questions`** — exactly three strings per category in Release 1. They
  should be debatable, broadly accessible, and free of hateful content.

## How it's loaded

`src/engine/topicsLoader.js` fetches this file. If the fetch fails (for example
when opening `index.html` from `file://`), it falls back to a small built-in
set so the argument-selection screen still works. Serve locally to load the
full file.
