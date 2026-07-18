# Architecture

This document maps the canonical vision (see the project's `vision/verbal-kombat-canon.md`) onto the codebase. The prime directive: **the fight visualizes the debate — its structure and dynamics, not just the score** — and **the game loop is a reinforcement learning loop**.

## The event pipeline

Everything is a pipeline of four typed transformations:

```
1. DebateAgent.nextArgument(ctx)   → ArgumentEvent      (an utterance)
2. Judge.evaluate(arg, history)    → JudgeVerdict       (soundness, evidence, structure, fallacies, rebuttal force)
3. applyVerdict(state, arg, v)     → CombatEvent[]      (violence + mutated MatchState)
4. buildReplay(...)                → MatchReplay        (the annotated transcript / ground truth)
```

`runMatch` in `@vk/replay` orchestrates the loop, alternating sides until knockout, script exhaustion, or turn cap. It is renderer-agnostic: the demo client subscribes to `onExchange` to animate; a headless self-play harness calls it in a loop and feeds `rewardSignal` back into training.

### Why the judge is the keystone

The judge's verdicts are simultaneously (a) the combat system's input, (b) the annotated transcript's content, and (c) the RL reward's basis. Judge quality is therefore the single most important correctness property in the system. The architecture treats judges as swappable behind one interface:

- `ScriptAwareJudge` — reads authored ground truth from a `DebateScript`. Deterministic; drives the demo; doubles as the golden oracle for evaluating real judges (run any candidate judge over a script, diff its verdicts against the annotations).
- `HeuristicJudge` — dependency-free lexical heuristics. A floor, not a ceiling.
- (next) `LlmJudge` — the production judge; an LLM or ensemble behind the same `Judge` interface, benchmarked against the scripted oracles.

### Combat semantics are data, not code

The fallacy taxonomy (`@vk/core/fallacies.ts`) carries combat semantics per fallacy: failure mode (`whiff` / `labeled_block` / `backfire`) and backfire damage. Adding a fallacy is a data change. The damage model lives in one place (`@vk/combat/mapper.ts`) with named tuning constants.

## Fighters are methodologies

`FighterArchetype.traits` (interrogation, empiricism, formalism, rhetoric, aggression, patience) shape both:

- **how the AI argues** — `styleSystemPrompt` in `@vk/debate/llm.ts` synthesizes the LLM system prompt from traits, so the fighter the user picked genuinely changes the model's argumentative behavior;
- **how the fighter animates** — the renderer reads the same traits and palette.

`fallacyRisk` per archetype makes styles fail in characteristic ways (Silver Tongue courts ad hominem; The Empiricist over-generalizes).

## The RL bridge

`xpForMatch` (player-facing progression) and `rewardSignal` (training scalar) are two views of the same replay, deliberately colocated in `@vk/core/progression.ts` so they cannot drift apart: improving the fighter the player sees IS improving the model underneath. The `ChatClient` interface in `@vk/debate/llm.ts` is the seam where a locally fine-tuned checkpoint attaches for self-play.

## Problem Mode

`@vk/debate/problem.ts`:

- `synthesizeProblemFighter(problem)` — gives the user's problem a body ("The Tangle") and a stance ("this problem cannot be cleanly resolved").
- `resolveProblemOutcome(replay, userSide)` — enforces the canon victory condition: the match is only won when it has produced sound logical reasoning (returns `null` otherwise — the fight isn't over). The foundation extracts the strongest clean exchanges; the production version hands the replay to a synthesis model.

## The replay is the ground truth

`MatchReplay.entries` are `TranscriptEntry` triples (argument ↔ verdict ↔ combat events) — every visible event carries `sourceArgumentId` back into the transcript. `entryAt(replay, t)` is the scrub index: any moment in the fight resolves to the exchange that caused it.

## What is deliberately NOT here yet

- No networking, persistence, or accounts — `FighterProfile` is defined but storage is out of scope for the foundation.
- No real LLM binding — `ChatClient` is the interface; the demo runs scripted so the whole pipeline is deterministic and testable without keys.
- The renderer is intentionally primitive (canvas stick fighters). It proves the visualization contract; art direction replaces it without touching the pipeline.
