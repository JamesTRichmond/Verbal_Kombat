# Content data

These are the **authoritative content files** the engine loads at runtime. They
are the one source of truth for each schema; design/content drafts (authored
under `/docs`) get transcribed into these shapes.

All files are loaded through `src/engine/dataLoader.js`, which uses the same
fetch-and-fallback pattern for each: if `fetch` fails (e.g. Chrome blocks
`file://`), the game falls back to a tiny built-in demo set and prints a note
in the console. To load the full files, serve locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Paths are configured in `src/core/config.js` under `dataUrls`.

---

## `fallacies.json` — argument moves

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

---

## `topics.json` — debate categories and questions

```jsonc
{
  "version": 1,
  "categories": [
    {
      "id": "food_culture",   // stable, unique, snake_case
      "name": "Food & Culture",
      "questions": [          // exactly 3 pre-written questions per category in R1
        "Does pineapple belong on pizza?",
        "...",
        "..."
      ]
    }
  ]
}
```

### Field rules

- **`id`** — stable snake_case identifier. Used to look up per-category line
  banks and to group custom questions.
- **`questions`** — array of question strings. R1 ships exactly 3 per category.
- Custom questions are always entered inside a selected category (see
  [DESIGN-v2.md](/docs/DESIGN-v2.md)). They inherit that category's line banks.
- **Security:** custom question text must never be rendered as raw HTML. Pass it
  through `VK.htmlEscape` before inserting into the DOM.

---

## `fighters.json` — roster stats, specials, and CPU behavior

```jsonc
{
  "version": 1,
  "fighters": [
    {
      "id": "logician",       // stable, unique, snake_case
      "name": "The Logician",
      "style": "Precise, counter-focused...",
      "stats": {              // all integers 1–10
        "reach": 7,
        "speed": 4,
        "power": 5,
        "defense": 7
      },
      "special": {
        "name": "Q.E.D.",
        "description": "..."
      },
      "lineBankKeys": [       // category ids this fighter can draw lines from
        "tech_ethics",
        "morality",
        "education"
      ],
      "cpu": {                // scripted opponent behavior per D10
        "aggressionCurve": [  // hpThreshold descending; pressure 0.0–1.0
          { "hpThreshold": 100, "pressure": 0.25 },
          { "hpThreshold": 60, "pressure": 0.35 },
          { "hpThreshold": 30, "pressure": 0.45 }
        ],
        "punishWindows": {    // frame advantage responses per situation
          "whiff": { "frames": 18, "response": "counter" },
          "heavyStartup": { "frames": 12, "response": "light" },
          "blockPushback": { "frames": 8, "response": "grab" }
        },
        "preferredRange": "mid", // "close" | "mid" | "far"
        "patience": 0.8       // 0.0 rushdown, 1.0 wait forever
      }
    }
  ]
}
```

### Field rules

- **`id`** — stable snake_case identifier. References line bank files by name
  (`data/lines/{id}.json`).
- **`stats`** — four scores 1–10. Balance references are in `src/core/config.js`
  and `/docs/BALANCE.md`.
- **`lineBankKeys`** — list of category ids. A fighter only draws lines from
  categories they know; a missing key means a generic fallback line is used.
- **`cpu`** — behavior pattern for the Release 1 scripted opponent. See D10 in
  `docs/DECISIONS.md`.

---

## `locations.json` — arenas and environmental events

```jsonc
{
  "version": 1,
  "locations": [
    {
      "id": "forum",
      "name": "The Forum",
      "description": "A marble amphitheater...",
      "palette": {            // renderer color hints
        "skyTop": "#1a237e",
        "skyBottom": "#3949ab",
        "floor": "#e0e0e0",
        "accent": "#ffd54f"
      },
      "environmentalEvent": { // one scripted event per arena in R1
        "id": "forum_echo",
        "trigger": "onLightHit",
        "cooldownSeconds": 20,
        "effect": {
          "type": "dialogueWeight",
          "multiplier": 2.0,
          "durationSeconds": 3
        },
        "announcement": "The Forum echoes your last point..."
      }
    }
  ]
}
```

### Field rules

- **`palette`** — hints for the renderer; may expand later.
- **`environmentalEvent.trigger`** — ledger event type that can fire the event.
  R1 triggers: `onLightHit`, `onCombo`.
- **`environmentalEvent.effect.type`** — R1 effects: `dialogueWeight`,
  `composureRegen`.

---

## `lines/{fighterId}.json` — per-fighter, per-category dialogue templates

```jsonc
{
  "version": 1,
  "fighterId": "logician",
  "categories": {
    "tech_ethics": {
      "lightHit": ["...", "..."],
      "heavyHit": ["..."],
      "counter": ["..."],
      "block": ["..."],
      "whiff": ["..."],
      "combo": ["..."],
      "special": ["..."]
    }
  }
}
```

### Field rules

- **`fighterId`** must match the id in `fighters.json` and the file name.
- Keys under `categories` must match `topics.json` category ids.
- Each event type holds an array of template lines. The dialogue engine picks
  one deterministically from the fighter's stream (D11).
- Templates may reference the current question text; use `VK.htmlEscape` on any
  interpolated user-provided string before rendering.

---

## Custom topic input and XSS safety

Custom questions are typed by the player inside a selected category. They are
stored as plain strings and must be treated as untrusted HTML whenever they are
rendered. The engine provides `src/engine/htmlEscape.js`, which exposes
`VK.htmlEscape(text)`. Always call it before inserting custom text (or any
text that may contain user input) into the DOM.

`VK.htmlEscape` escapes `&`, `<`, `>`, `"`, and `'`, covering text content and
attribute contexts. It does not sanitize URLs or allow markup; for Release 1,
user text is plain text only.
