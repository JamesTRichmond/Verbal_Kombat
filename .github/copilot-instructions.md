# Verbal Kombat repository instructions

Read `AGENTS.md` before making changes. It is the detailed working agreement; this
file is a short routing guide, not a replacement for it.

## Architecture that must remain true

- Preserve the traceable pipeline `ArgumentEvent -> JudgeVerdict -> CombatEvent[]
  -> MatchReplay`. Combat events must retain their `sourceArgumentId`.
- Keep domain and orchestration logic in `packages/*`; `apps/game` presents the
  result and must not become the authority for judging, damage, or winners.
- Keep `ChatClient` provider-agnostic. Never place provider credentials in browser
  code or commit credentials, private prompts, transcripts, or authorization data.
- Distinguish deterministic fixtures, heuristic evaluation, live model calls,
  prompt-level learning, and model-weight training. Do not describe one as another.
- Fighter growth is additive durable data. Read `docs/GROWTH.md` before changing
  careers, lessons, persistence, or training.

## Where to work

- `packages/core`: shared domain types, fighters, fallacies, council scoring, and
  progression.
- `packages/debate`: debate/proposal agents and model integration interfaces.
- `packages/judge`: argument evaluation and verdicts.
- `packages/combat`: verdict-to-combat mapping.
- `packages/replay`: match/council orchestration and traceable replays.
- `packages/lab`: headless decision, arena, persistence, and training tools.
- `apps/game`: Vite/canvas presentation and arcade UI.

Use `.js` suffixes for relative TypeScript imports, matching the ES-module source.
Put focused Vitest tests beside the implementation as `*.test.ts`.

## Safe verification

- Prefer deterministic, credential-free tests. Never invoke live providers for a
  routine verification run.
- Lab commands can write fighter careers. Use a temporary data directory; do not
  train against or regenerate committed `data/fighters` incidentally.
- Root checks are `npm test`, `npm run typecheck`, `npm run build`, and
  `git diff --check`. The game package has dev/build/preview scripts but no
  package-level test script; use root `npm test` for the configured Vitest suite.
- Check the current manifests and implementation before relying on these notes.
  Treat `docs/ROADMAP.md` as intent, not evidence that a feature exists.
