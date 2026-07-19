# Content data

This directory holds the **authoritative content files** the engine loads at runtime.
They are the source of truth for their schemas; design/content drafts (authored
under `/docs`) get transcribed into these shapes.

## `fallacies.json`

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

## `topics.json`

```jsonc
{
  "version": 1,
  "categories": [
    {
      "id": "food",           // snake_case, stable
      "name": "Food",         // display label
      "questions": [          // three pre-written questions
        "Should pineapple belong on pizza?",
        "..."
      ],
      "bank": "default"       // dialogue bank key
    }
  ]
}
```

## `fighters.json`

```jsonc
{
  "version": 1,
  "fighters": [
    {
      "id": "logician",       // snake_case, stable
      "name": "The Logician", // display name
      "style": "Counter-focused",
      "stats": { "precision": 8, "pressure": 5 },
      "special": "Reductio Ad Absurdum"
    }
  ]
}
```

## `locations.json`

```jsonc
{
  "version": 1,
  "locations": [
    {
      "id": "forum",
      "name": "The Forum",
      "palette": "warm",
      "event": { "name": "Echo Chamber", "description": "..." }
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

`src/engine/dataLoader.js` fetches `fallacies.json`; `src/engine/setupData.js`
fetches the selection content (`topics.json`, `fighters.json`, `locations.json`).
Opening `index.html` directly from disk works in most browsers, but some
(e.g. Chrome) block `fetch` on `file://`.
In that case the game falls back to a tiny built-in demo set and prints a note
in the console. To load the full file, serve locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
