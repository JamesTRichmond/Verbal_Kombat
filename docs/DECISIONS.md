# Design decisions

This log records the reasoning behind product and technical choices for VerbalKombat. Each entry is short on purpose. When a decision is revisited, add a new entry rather than editing an old one.

## D1. Release 1 is intentionally minimal

**Context.** VerbalKombat is a browser fighting game where players attack with sound arguments. The interesting risk is not "can we render a health bar" — it is "is this actually fun and legible to play." A small, complete slice is the fastest way to answer that.

**Decision.** Release 1 ships exactly: one player, one scripted opponent, one debate prompt, one counterargument, deterministic scoring, health/damage, a verdict, and replay.

**Consequences.** No content system, no matchmaking, no progression. Every module can be read end-to-end. Later releases can widen the scope once the core loop is proven.

## D2. Text input, not voice, for Release 1

**Context.** The game's premise ("sound arguments") suggests voice, and eventually we want it. But voice input adds browser-permission flows, speech-to-text (either a large in-browser model or a paid API), latency, accessibility considerations, and testability problems.

**Decision.** Release 1 accepts arguments as typed text only.

**Consequences.** Zero permissions, zero external services, and the scoring module receives a clean string it can test against. Voice is deferred until the text version proves the core loop is fun. Revisiting voice will require its own decision entry covering the transcription approach.

## D3. Deterministic local scoring, not generative-AI judging

**Context.** An LLM judge would give richer feedback, but it would also make the game non-deterministic, dependent on an external API, subject to rate limits and cost, hard to test, and opaque to players who lose a round and want to know why.

**Decision.** Release 1 scores arguments with a deterministic function implemented in plain JavaScript in this repo. The function returns both a score and a breakdown of the factors that produced it, and the UI surfaces the breakdown.

**Consequences.**

- Scoring is testable with plain unit assertions.
- Players can see and reason about why they took damage.
- The heuristics will be crude compared to an LLM — this is an accepted trade-off for Release 1.
- Generative-AI judging is deferred. If it is added later, it must not be the sole judge (players should still get a transparent, local explanation), and it must be behind a decision entry covering cost, latency, and offline behavior.

## D4. Dependency-free static web app

**Context.** A JavaScript ecosystem project can accumulate a bundler, a framework, a test runner, a linter, and their transitive dependencies before a single feature ships. For a project this small, that machinery is pure overhead — and it raises the barrier for casual contributors.

**Decision.** Release 1 uses plain HTML, CSS, and JavaScript with no runtime dependencies, no bundler, and no framework. Tests run in the browser via a tiny inline harness.

**Consequences.** Once gameplay is implemented, cloning the repo, serving the project root, and opening `index.html` will be the full setup. There is no `package.json` to audit and no lockfile to keep current. If a future feature genuinely requires a dependency, it must be justified in a new decision entry.

## D5. No backend, auth, or persistence in Release 1

**Context.** A backend enables leaderboards, saved matches, and shared prompts, but it also means hosting, secrets, deploy pipelines, and a whole class of security concerns.

**Decision.** Release 1 is 100% client-side. Nothing is persisted across a page reload.

**Consequences.** The project can be hosted on any static file host or served locally with a static file server. Any future feature that needs state beyond the tab must be introduced with its own decision entry.

---

Entries D6 onward record the fighting-game pivot described in [DESIGN-v2.md](./DESIGN-v2.md). The governing principle for all of them: **the player wins the argument through the way they fight** — combat performance generates the argument, not the other way around. Where an entry supersedes an earlier one, it says so; per this log's convention, the old entry stays in place.

## D6. Combat fidelity ceiling: real-time-lite

**Context.** The pivot replaces the typed-argument round with real-time combat, and the fidelity ceiling drives roughly 60% of the scope. A true fighting game (spacing, frame timing, an air game, frame-data depth) is a multi-year discipline; a rhythm/timing-lite minigame would be too shallow to make combat choices feel like argumentative choices.

**Decision.** Release 1 combat is real-time-lite: real left/right movement and real timing, with light attack, heavy attack, block, and a metered special — but no air game and no frame-data depth. (Supersedes D1's definition of the Release 1 slice; the "small, complete, legible" reasoning carries over unchanged.)

**Consequences.** Combat is deep enough that how you fight is expressive (pressure vs. patience, counters vs. swings) and shallow enough to build, balance, and playtest in one release. Raising the ceiling (air game, frame data) requires a new decision entry.

## D7. Dialogue source: template banks, with the ledger shaped for a later AI swap

**Context.** Fight dialogue can come from per-fighter template banks (offline, free, deterministic, GitHub Pages-compatible) or live Claude generation (needs the Node server and a key — Pages cannot keep a secret). A persona/referee server already exists in the verbalkombat-standalone lineage.

**Decision.** Release 1 draws every line from per-fighter, per-category template banks keyed by ledger event type. The ledger event format is designed so that swapping the template selector for an AI generator is a drop-in change — the persona/referee server from the staged branch is exactly that future component.

**Consequences.** Zero server, zero cost, deterministic and testable dialogue; lines will be less varied than generated text, which is accepted for R1. The AI swap, when it comes, gets its own decision entry covering cost, latency, and offline fallback (consistent with D3's constraint that generative AI must never be the sole, unexplainable judge).

## D8. The match ledger is the single source of truth

**Context.** The game's two promises — "every line is earned" and "every verdict is explainable" — could each be implemented ad hoc, or both could be guaranteed by one structural rule.

**Decision.** Every combat event (hit, whiff, block, counter, combo, special, environmental event) is a typed, timestamped record appended to a match ledger. The dialogue engine and the judges read only the ledger — never the live combat state, never each other.

**Consequences.** No line can appear without a causing event, and any verdict can be recomputed and explained from the ledger alone. This extends D3's explainable-scoring principle to the pivot: judges are weight vectors over ledger events, so the verdict screen's "top contributing moments" fall out of the architecture rather than being bolted on. All new combat features must define their ledger events as part of their design.

## D9. Codebase lineage: build on the PR #4 scaffold

**Context.** Three lineages exist: the deployed text prototype (the quiz), the PR #4 scaffold (`src/engine/` — game loop, pure combat rules, renderer separation, data-driven content), and the staged fatality game's select-screen/verdict work.

**Decision.** The pivot builds on the PR #4 scaffold's engine, folding in the select-screen and verdict DNA from the staged fatality game. The deployed text prototype is retired from the main flow but kept reachable behind a "Classic mode" link until the pivot ships, then reviewed.

**Consequences.** New work extends `src/engine/` rather than `app.js`/`combat.js` at the repo root. The dataLoader fallback pattern is the model for all new content files (topics, fighters, locations, line banks). D1 and D2 are superseded as descriptions of the current release; their minimalism-first reasoning still governs scope.

## D10. CPU opponent: scripted per-fighter behavior patterns

**Context.** Release 1 is one player vs. one CPU. Opponent intelligence could range from a fixed input script to an adaptive/learning AI.

**Decision.** Each fighter gets a scripted behavior pattern — an aggression curve and defined punish windows that express their argumentative style (e.g. the Logician waits and counters; the Demagogue swings heavy). No learning AI in R1.

**Consequences.** CPU behavior is deterministic (with D11), testable, and tunable per fighter during the balance pass. It will be exploitable by players who learn the patterns; acceptable for a single-round R1.

## D11. Determinism: seeded RNG from day one

**Context.** Combat, CPU behavior, and dialogue line selection all involve randomness. Unseeded randomness would make the e2e smoke test flaky and the balance pass unreproducible.

**Decision.** All randomness flows through a single seeded RNG owned by the match. Given the same seed and inputs, a match produces an identical ledger — and therefore identical dialogue and an identical verdict.

**Consequences.** Playwright can run a fully deterministic match; balance changes can be A/B'd against fixed seeds; bug reports can include a seed. No module may call `Math.random()` directly.

## D12. Names and trade dress: original everywhere

**Context.** Mortal Kombat and Raphael's *School of Athens* are pacing/structure/atmosphere references only.

**Decision.** Everything player-facing is original: no "FATALITY"/"FINISH HIM," no MK logotype styling, original fighter names (the Logician, the Demagogue, the Empiricist, the Trickster), and original judge characters — archetypes inspired by *School of Athens* perspectives (the Idealist, the Empiricist, the Skeptic) with original names and original art, not reproductions, even though the painting itself is public domain. The finisher term is ours: **"THE FINAL WORD."**

**Consequences.** No trademark or trade-dress exposure; all art and copy tasks start from original material. Any future homage that goes beyond structure/pacing reference needs its own decision entry.
