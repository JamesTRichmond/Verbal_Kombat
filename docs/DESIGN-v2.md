# Design v2 — The Fighting Game Pivot

> Core principle to preserve in everything: **the player wins the argument through the way they fight.**

## 1. Current state vs. vision — the major differences

The deployed prototype is a turn-based writing quiz; the vision is a real-time fighting game that writes. The gaps, in order of significance:

| Dimension | Current (deployed) | Vision |
|---|---|---|
| Causality | Your typed argument determines damage — the argument is the fight | Combat performance generates the argument — the inversion is the whole game |
| Player verb | Compose text in a 420-char box | Move, strike, block, combo, time specials |
| Flow | One screen, straight into the round | Argument → Fighter → Location → Fight → Verdict |
| Topic | One hardcoded question (pineapple pizza) | 8 categories + custom entry |
| Fighters | Anonymous "YOU vs AI" labels | Identity-rich roster with styles, stats, signature moves |
| Arena | None (static backdrop) | Selectable locations with presentation and eventual tactics |
| Dialogue | Player-authored, one blockquote at a time | System-generated from combat events, readable mid-fight |
| Judging | Single opaque score into an HP bar | Multi-judge board with named criteria and an explainable verdict |

One asset worth noting: the repo's PR #4 scaffold (game loop, pure combat rules, renderer separation, data-driven content) is architecturally much closer to this vision than the deployed text prototype — it's the right foundation to build on.

## 2. Smallest playable version that proves the loop

One player vs. one scripted CPU, one round, ~90 seconds, fully offline (GitHub Pages-compatible):

1. **Argument select** — 8 category chips; picking one shows 3 pre-written questions from `data/topics.json`, plus a custom-question field.
2. **Fighter select** — a roster of 4 original fighters, each defined by an argumentative style that maps to a combat style: e.g. The Logician (precise, counter-focused), The Demagogue (heavy swings, crowd-feeding), The Empiricist (jab pressure, evidence combos), The Trickster (mobility, interrupts). Grid select with a big identity panel: portrait, style, 2 stats, one named special.
3. **Location select** — 2 arenas (say, The Forum and The Studio). Release 1 scope: distinct palette/parallax/crowd audio and one scripted environmental event each (e.g. the Forum's echo doubles the next landed point's dialogue weight). Cosmetic-plus, not full tactics yet.
4. **The fight** — real-time-lite 2D combat: left/right movement, light attack, heavy attack, block, special on a meter. Landed hits, whiffs, blocks, counters, 3-hit combos, and specials each emit events into a match ledger.
5. **Dialogue from the ledger** — each event draws a line from a per-fighter, per-category template bank: light hit = advance a point; combo = a developed multi-clause argument; special = the fighter's signature rhetorical technique; whiff = a stumble the opponent can verbally punish; counter = a direct rebuttal. A bottom ticker shows at most one line per ~2.5s (queue and drop rules) so it never obstructs combat. Every line cites the event that earned it — that's the design principle made mechanical.
6. **Verdict** — a board of 3 judges (archetypes inspired by School of Athens perspectives, with original names and art): the Idealist (weights logical consistency, rhetorical technique), the Empiricist (evidence quality, relevance, execution), the Skeptic (rebuttals, discipline, combat control). Each judge is a weight vector over the same event ledger. The verdict screen shows per-judge scores with the top 3 contributing moments ("The Skeptic favors the Logician: counter at 0:42 converted the Heckler's overreach into a rebuttal, +8"). Explainability falls out of the architecture rather than being bolted on.

This proves every promise in the vision with 4 fighters, 2 arenas, ~24 topics, template dialogue, and zero server.

## 3. Prioritized GitHub issues

**Milestone: Release 1 — "The Fight Writes"** (in build order; each blocks the next except where noted)

1. **Design decisions record** — Land the answers to §5 as `docs/DECISIONS.md`. AC: every §5 question has a written decision; PR approved before combat work starts.
2. **Data schemas + seed content** — `topics.json` (8 categories × 3 questions), `fighters.json` (4 fighters: stats, style, special, line-bank keys), `locations.json` (2 arenas), `lines/` template banks. AC: schemas documented in `data/README`; content loads with the existing dataLoader fallback pattern; custom topic input is escaped/XSS-safe.
3. **Screen flow state machine** — Argument → Fighter → Location → Fight → Verdict, keyboard + mouse navigable, back-navigation supported. AC: can traverse the full flow with placeholder screens; deep state (selections) survives to the verdict.
4. **Argument selection screen** — categories, question picker, custom entry. AC: selection lands in match state; custom text capped and sanitized.
5. **Fighter selection screen** — roster grid + identity panel. AC: portrait, style description, stats, and special are visible before confirming; CPU opponent auto-assigned or player-picked.
6. **Location selection screen** — 2 arenas with visual identity. AC: arena changes fight backdrop/palette; chosen arena recorded in ledger for judging.
7. **Combat core** (largest issue — consider splitting movement/attacks/blocking) — entities, input, hitboxes, HP, knockback, block, round timer, KO. AC: two fighters can fight to KO or time-out at 60fps; all combat events emit to the ledger with timestamps; deterministic under a seeded RNG for tests.
8. **Combos + special meter** — 3-hit chain detection, meter build/spend. AC: combo and special events appear in the ledger distinctly from singles.
9. **Dialogue engine + ticker** — ledger events → line selection → throttled display. AC: max 1 line per 2.5s; no line without a causing event; combo lines are visibly more developed than jab lines; fight remains playable with ticker ignored.
10. **Judge board + verdict screen** — 3 weight-vector judges, scorecards, top-contributing-moments list, closing statements generated from the winner's strongest ledger run. AC: verdict math is reproducible from the ledger; a player can point to why they lost; conclusion text reflects the actual final moments of the match.
11. **Balance + playtest pass** — tune damage, meter, line frequency. AC: a first-time player finishes a match in under 3 minutes and can articulate one rule of the scoring unprompted.
12. **E2E smoke test** — scripted-input Playwright run of the full loop. AC: flow completes headlessly with zero page errors; verdict screen renders judge scores.

**Later-milestone issues (file now, don't schedule):** environmental tactics as real mechanics; Claude-powered dialogue via the persona/referee server pattern (already built in the verbalkombat-standalone lineage — direct reuse); 7-judge full board; second human player (hotseat); fighter roster expansion; sound/announcer; mobile controls.

## 4. Release 1 vs. later

**Release 1 must have:** the 3 selection screens (with custom topics), 4 fighters, 2 arenas, real-time-lite combat with combos and one special each, template-based earned dialogue, 3-judge explainable verdict, fully static hosting (works on the existing Pages URL), keyboard-first with visible focus states.

**Explicitly deferred:** AI-generated dialogue (needs a server — Pages can't keep a secret key), environmental tactics (R1 arenas are presentation + one scripted event), voice, multiplayer, campaign, accounts/persistence, cosmetics, app-store packaging, more judges, touch controls.

## 5. Decisions to settle before implementation

1. **Combat fidelity ceiling** — a true fighting game (spacing, frame timing) vs. rhythm/timing-lite. This drives 60% of the scope. Recommendation: real-time-lite as specced above — real movement and timing, no air game, no frame-data depth.
2. **Dialogue source for R1** — template banks (offline, free, deterministic, Pages-compatible) vs. live Claude generation (needs the Node server + key). Recommendation: templates for R1 with the ledger designed so the later AI swap is a drop-in — the persona/referee server from the staged branch is exactly that future component.
3. **The ledger as the single source of truth** — commit now to: every combat event is a typed, timestamped record; dialogue and judging both read only the ledger. This one decision guarantees "every line is earned" and "every verdict is explainable."
4. **Codebase lineage** — build on the PR #4 scaffold's engine (recommended), fold in the select-screen/verdict DNA from the staged fatality game, and decide the deployed text prototype's fate (retire, or keep behind a "Classic mode" link).
5. **CPU opponent model** — scripted per-fighter behavior patterns for R1 (aggression curves, punish windows); no learning AI.
6. **Determinism** — seeded RNG from day one, or the e2e tests and balance work get much harder.
7. **Names and trade dress** — original everywhere: no "FATALITY"/"FINISH HIM," no MK logotype styling, original fighter names, and original judge characters. (The School of Athens itself is public domain, but the judges should be original archetypes inspired by its perspectives — e.g. "The Idealist," "The Empiricist," "The Skeptic" — with original art, not reproductions.) Suggested finisher term that's ours: "THE FINAL WORD."

On copyright (confirmed): everything above uses Mortal Kombat and Raphael only as pacing/structure/atmosphere references — original names, art, UI, and terminology throughout.

---

*Note: PR #4's scaffold (`src/engine/`, `data/fallacies.json`) is the intended foundation. A separate lineage with an AI referee server exists on the `verbalkombat-standalone` branch of AgentiCubed/agenticubed if that code is ever needed.*
