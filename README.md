# VERBAL KOMBAT 🥊

[![CI](https://github.com/JamesTRichmond/VerbalKombat/actions/workflows/ci.yml/badge.svg)](https://github.com/JamesTRichmond/VerbalKombat/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*Settle it in the arena of ideas.* A Mortal Kombat–style **debate decider**: pick two
fighters — Socrates, Einstein, Cleopatra, Kanye, Gordon Ramsay, or anyone you type in —
give them a question and opposing positions, and let them fight it out over three rounds.

## How it works

- **Hits are good arguments.** Jab = cited evidence (safe), Hook = logic chain (medium
  risk), Haymaker = zinger (high risk, big damage).
- **Misses are logical fallacies.** Risky moves can whiff into a named fallacy —
  STRAWMAN, AD HOMINEM, SLIPPERY SLOPE… — which gets **BLOCKED** and costs you
  credibility and health.
- **Special moves** charge as you land hits (Einstein's THOUGHT EXPERIMENT, Ramsay's
  IDIOT SANDWICH, Serena's ACE SERVE…).
- Win two rounds, then **FINISH THEM** with a signature **FATALITY** — Kanye's
  IMMA LET YOU FINISH, Shakespeare's EXIT PURSUED BY A BEAR.
- When it's over, the **official transcript** is generated: the winning (majority)
  opinion, the dissent, and the full record of the bout. Print it or download it.

## Play

Open `index.html` in any browser. No install, no build, no server — the whole game is
one self-contained file. Choose **You control Fighter 1** to play, or **Spectate** to
watch the CPU argue with itself.

## Develop

The game is plain HTML/CSS/JS in `index.html`. End-to-end tests run the real game in
headless Chromium:

```bash
npm ci
npx playwright install --with-deps chromium
npx playwright test
```

The suite plays a full CPU-vs-CPU match through fatality and transcript generation,
and includes an XSS regression test for custom fighter names.

## Where this is going

See [VISION.md](VISION.md) — the five-phase plan from browser toy to AI-refereed
argument sport: the Referee Engine (Claude-powered live arguments scored for evidence,
logic, and fallacies), party mode, the Logic League, and beyond.

## History

Born in the [`agenticubed`](https://github.com/AgentiCubed/agenticubed) monorepo and
extracted here with full commit history.

## License

[MIT](LICENSE)
