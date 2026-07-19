# Architecture

VerbalKombat Release 1 is a **dependency-free static web application**. It runs entirely in the browser from static files, with no build step, no bundler, no backend, and no runtime dependencies.

## Goals

- A new contributor can read the whole codebase in one sitting.
- Anyone can open `index.html` and play the game — no toolchain required.
- Scoring is transparent and reproducible: same inputs always yield the same score and verdict.

## High-level shape

```
┌──────────────────────────────────────────────────────────┐
│                        index.html                        │
│  (markup for the arena, prompt, input box, health bars,  │
│   verdict panel, and replay button)                      │
└──────────────────────────────────────────────────────────┘
             │                    │                │
             ▼                    ▼                ▼
     ┌───────────────┐   ┌────────────────┐   ┌──────────┐
     │   UI module   │◄──│ Round state    │──►│ Scoring  │
     │  (DOM render, │   │ (health, turn, │   │ module   │
     │  event wiring)│   │  phase, log)   │   │ (pure)   │
     └───────────────┘   └────────────────┘   └──────────┘
                                 ▲                 ▲
                                 │                 │
                          ┌──────┴──────┐   ┌──────┴──────┐
                          │   Prompt/   │   │    Tests    │
                          │ opponent    │   │ (browser    │
                          │  script     │   │  harness)   │
                          └─────────────┘   └─────────────┘
```

## Modules

### UI module

- Owns all DOM reads and writes.
- Renders the current prompt, the opponent's scripted counterargument, both health bars, the running exchange log, and the end-of-round verdict.
- Wires up the submit action on the input box and the replay button.
- Contains no scoring logic and no rules about when the round ends — it asks round state.

### Round state

- Holds the mutable state for a single match: player and opponent health, whose turn it is, the current phase (awaiting input, resolving, ended), and an ordered log of exchanges.
- Exposes a small API such as `submitArgument(text)`, `getState()`, and `reset()`.
- Calls the scoring module to evaluate a submitted argument, applies the resulting damage, decides whether the round is over, and returns the new state to the UI.

### Scoring module

- A **pure function** of its inputs: `score(argumentText, promptContext) -> { score, damage, breakdown }`.
- Deterministic: no randomness, no time, no network, no storage.
- Transparent: the returned `breakdown` explains which factors contributed to the score (e.g. structural cues, keyword coverage, length bounds). The UI surfaces this so players understand the verdict.
- No dependencies. All heuristics are implemented in plain JavaScript in this repo.

### Prompt / opponent script

- Static data for Release 1: one debate prompt and one scripted counterargument the opponent delivers on its turn.
- Kept as a plain JavaScript object or JSON so it is trivial to inspect and extend later.

### Tests

- A browser-based test harness (e.g. `tests.html` loading `tests.js`) exercises the scoring module and round state with a small set of assertions.
- Because scoring is pure, tests can pin specific inputs to expected outputs and catch regressions immediately.

## Data flow for one exchange

1. Player types an argument and submits.
2. UI calls `roundState.submitArgument(text)`.
3. Round state calls `score(text, prompt)` and receives `{ score, damage, breakdown }`.
4. Round state applies `damage` to the opponent's health and appends to the log.
5. Opponent's scripted counterargument fires; round state applies its (pre-defined) damage to the player.
6. Round state checks health; if either side is at zero it transitions to the `ended` phase and computes a verdict.
7. UI re-reads state and updates the DOM (health bars, log entry with breakdown, verdict panel if ended).
8. Replay resets round state and re-renders.

## Non-goals for Release 1

- No frameworks, bundlers, or package managers.
- No backend, database, authentication, or telemetry.
- No voice input, speech recognition, or audio analysis.
- No calls to generative-AI or any external services.
- No persistence beyond a page reload.

See [`DECISIONS.md`](DECISIONS.md) for the reasoning behind these boundaries.
