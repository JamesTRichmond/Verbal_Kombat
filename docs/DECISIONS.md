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

**Consequences.** `git clone` and open `index.html` is the full setup. There is no `package.json` to audit and no lockfile to keep current. If a future feature genuinely requires a dependency, it must be justified in a new decision entry.

## D5. No backend, auth, or persistence in Release 1

**Context.** A backend enables leaderboards, saved matches, and shared prompts, but it also means hosting, secrets, deploy pipelines, and a whole class of security concerns.

**Decision.** Release 1 is 100% client-side. Nothing is persisted across a page reload.

**Consequences.** The project can be hosted on any static file host (or none — it works from `file://`). Any future feature that needs state beyond the tab must be introduced with its own decision entry.
