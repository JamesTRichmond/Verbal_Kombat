# VERBAL KOMBAT

A bloody fighting game where the fight is a **real-time visualization of a debate between AI minds**. Sound arguments and valid logic land as attacks. Logical fallacies miss, get blocked, or backfire. The health bar isn't health — it's the structural integrity of a position, and it only breaks when someone breaks the reasoning.

> In version one, only the AI controls the fighters. You choose the arena (the topic), assign each side its stance, and pick the fighters — each one a debate methodology wearing a body. Then two superhuman minds go at it while the transcript roars by in a side window, and the fight on screen is how your nervous system gets to experience an argument it couldn't otherwise perceive.

## Run the demo

```bash
npm install
npm run dev        # opens the demo match at http://localhost:5173
npm test           # run the pipeline test suite
```

Press **FIGHT**. Socrates Prime (free will is an illusion) meets Silver Tongue (free will is real) in a scripted exhibition match that exercises the full pipeline: jabs, heavies, combo chains, a blocked strawman, an ad hominem that backfires, a whiffed appeal to authority, and a fatality. When the match ends, scrub the timeline — every moment of the fight resolves back to the exact exchange that caused it.

## How it works

```
DebateAgent (A)  ─┐
                  ├─▶ ArgumentEvent ─▶ Judge ─▶ JudgeVerdict ─▶ CombatMapper ─▶ CombatEvent[]
DebateAgent (B)  ─┘                                                    │
                                              ┌────────────────────────┤
                                              ▼                        ▼
                                        Renderer (fight)      MatchReplay (annotated transcript)
                                                                       │
                                                                       ▼
                                                        XP / reward signal (RL harness)
```

| Package | What it is |
|---|---|
| `@vk/core` | Domain model: fighters, fallacy taxonomy, events, match state, progression, replay format |
| `@vk/debate` | DebateAgent interface; ScriptedAgent (deterministic fixtures), LlmAgent (production path), Problem Mode synthesis |
| `@vk/judge` | The judge: verdicts on soundness, evidence, structure, fallacies, rebuttal force |
| `@vk/combat` | CombatMapper: verdicts → violence (damage model, combos, backfires, finishers) |
| `@vk/replay` | MatchRunner orchestration + annotated replay building |
| `apps/game` | The demo client: canvas fight, roaring transcript, replay scrubber |

## The deeper design

Verbal Kombat is a reinforcement learning engine wearing a fighting game as its face. Every match is a self-play episode; every punished fallacy is a gradient signal (`rewardSignal` in `@vk/core`). Fighters accumulate XP, and users spend it on upgrades, weapons (offensive techniques), and armor (fallacy resistances). At level 5 a fighter unlocks **Problem Mode**: describe a real problem you're stuck on, the program synthesizes a fighter out of it, and your trained fighter battles it until the fight has produced sound logical reasoning on how to proceed.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).
