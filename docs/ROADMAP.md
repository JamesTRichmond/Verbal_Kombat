# Roadmap

## Phase 0 — Foundation (this repo, done)

- Typed event pipeline: agents → judge → combat → replay
- Fallacy taxonomy with combat semantics
- Starting roster of four archetypes (methodologies, not skins)
- Scripted demo match exercising every combat event type, with tests
- Canvas demo client: fight view, live transcript, verdict panel, replay scrubber
- Progression + RL reward primitives (`xpForMatch`, `rewardSignal`)
- Problem Mode primitives (synthesis + canon victory condition)

## Phase 1 — Real minds

- `LlmJudge` behind the `Judge` interface; benchmark against scripted golden oracles
- Bind `ChatClient` to a model provider; live LLM-vs-LLM matches
- Debate-time pacing: stream utterances as they generate; transcript roars for real
- Judge ensemble + calibration suite (a library of annotated scripts as eval fixtures)

## Phase 2 — The game

- Match setup flow: pick topic, assign stances, pick fighters
- Art pass: real fighter animation sets keyed to CombatEventType, arena themes per topic domain
- Sound design; announcer ("FINISH HIM" → closing argument)
- Persistence: fighter profiles, XP, match history; post-match annotated transcript viewer

## Phase 3 — The loop closes (RL)

- Headless self-play harness: `runMatch` in bulk, `rewardSignal` → training pipeline
- Fighter checkpoints: a profile's level binds to a model/adapter checkpoint — leveling IS training
- Upgrades/weapons/armor mapped to concrete capability deltas (prompt tools → adapter weights)

## Phase 4 — Problem Mode ships

- Problem intake flow → `synthesizeProblemFighter` with a real model
- Synthesis judge for `resolveProblemOutcome`: the match ends only when sound reasoning exists
- Deliverable: the reasoned conclusion + the annotated transcript that earned it

## Phase 5 — Arena of others

- User-created opponents; sharing; ladders
- Spectator modes; live match streaming
