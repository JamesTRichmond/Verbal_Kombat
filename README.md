# VerbalKombat

VerbalKombat is a fighting game where attacks are performed through sound arguments and logic.

## Documentation

- [Contributing guide](CONTRIBUTING.md) — local setup, testing, branch/PR expectations, and the Release 1 scope boundary.
- [Architecture](docs/ARCHITECTURE.md) — the dependency-free static-web design: UI, round state, scoring module, and tests.
- [Design decisions](docs/DECISIONS.md) — why Release 1 uses text input and deterministic local scoring, and defers voice and generative-AI judging.

## Release 1: smallest playable game

Release 1 is complete when a player can open the game in a modern browser and finish one fair, understandable verbal-combat round without setup.

Included: one player, one scripted opponent, one prompt, text input, transparent scoring, health, damage, a verdict, replay, and a responsive accessible interface.

Deferred: voice input, generative AI judging, multiple opponents, campaign progression, multiplayer, accounts, persistence, cosmetics, and app-store packaging.

## Run

`npm start`, then open http://localhost:8000. Run `npm test` to verify scoring.
