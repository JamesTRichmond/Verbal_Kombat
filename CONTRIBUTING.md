# Contributing to VerbalKombat

Thanks for your interest in VerbalKombat — a browser fighting game where attacks are performed through sound arguments and logic. This guide covers what you need to get productive.

## Project snapshot

VerbalKombat Release 1 is intended to run entirely in the browser. There is no backend, no build step, and no runtime dependencies. Release 1 is intentionally small (see [Release 1 scope](#release-1-scope) below).

For architectural context, read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). For the reasoning behind key product/technical trade-offs, read [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Local setup

Prerequisites: a modern browser (Chromium, Firefox, or Safari) and `git`.

```bash
git clone https://github.com/JamesTRichmond/Verbal_Kombat.git
cd Verbal_Kombat
```

To run the game once gameplay is implemented, open `index.html` directly in your browser, or serve the project root with any static file server, for example:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

No `npm install`, no bundler, no toolchain. If a change would require one, open an issue first.

## Testing expectations

- The scoring module and round-state logic must be covered by unit tests written in plain JavaScript that run in the browser (a simple `tests.html` harness is sufficient for Release 1).
- Tests should be deterministic: given the same inputs, the scoring module must always produce the same score and verdict.
- Before opening a PR, open the test harness in a browser and confirm all assertions pass. Include a short note in the PR describing what you exercised manually (which prompt, which counterargument, expected verdict).
- Do not introduce a test framework as a production dependency. A tiny inline assertion helper is fine.

## Branch and PR expectations

- Branch from the default branch. Use a short descriptive name, e.g. `feat/scoring-module` or `docs/architecture`.
- Keep PRs small and focused on a single concern. Documentation PRs should not mix in gameplay code, and vice versa.
- Write a clear PR description that includes:
  - What changed and why.
  - How you verified it (tests run, manual steps).
  - Any Release 1 scope implications.
- Link the issue the PR closes.
- Do not force-push over review feedback; add follow-up commits so reviewers can see the diff.

## Release 1 scope

Release 1 is deliberately narrow. In scope:

- One player and one scripted opponent.
- One debate prompt with one counterargument.
- Transparent, deterministic local scoring.
- Health and damage, a verdict at the end of the round, and a replay control.
- Text input only.

Out of scope for Release 1 (do not add these without an explicit issue and decision update):

- Additional prompts, opponents, or rounds.
- Voice input or speech recognition.
- Generative-AI judging or any external API calls.
- Backend services, authentication, or user accounts.
- Frameworks (React, Vue, etc.), bundlers, or runtime dependencies.
- License changes.

If a change you want to make crosses these boundaries, open an issue proposing a scope change before writing code.

## Code style

- Plain HTML, CSS, and JavaScript (ES modules are fine).
- Keep modules small and pure where possible; the scoring module in particular must be a pure function of its inputs.
- Prefer clarity over cleverness — a new contributor should be able to read a module top-to-bottom and understand it.
