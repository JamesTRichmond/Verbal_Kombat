# Game Plan — from engine to arcade cabinet to decision instrument

Set by a Swarm-of-Geniuses council (7 seats). Methods borrowed, no one quoted.

## Council verdict

Build the **feel** of a 16-bit arcade fighter, but make the **crown** answer to truth. Every hit must trace to a sentence; every winner must be the highest calibrated EV for the owner — not the best animation.

| Seat | Move applied |
|---|---|
| Socrates (Questioners) | "On par with a 16-bit classic" means feel, weight, readability, secrets — not copied assets. |
| John Carmack (Builders) | Fixed 60 Hz loop, native low-res buffer, measure frame time, ship one playable loop first. |
| Chien-Shiung Wu (Experimenters) | The load-bearing assumption is "the judge is right." Calibrate it against fixtures or the game lies beautifully. |
| Blaise Pascal (Formalizers) | Always seat a "status quo" baseline; a choice must beat doing nothing on EV. |
| Sun Tzu (Strategists) | Strongest attack on the product: it entertains but decides nothing. Answer: decision records + Brier scoring against real outcomes. |
| B. F. Skinner (Mind-Mappers) | Juice is reinforcement: hitstop, shake, blood, sound within 50 ms of the judged event. |
| Amartya Sen (Society-Shapers, wildcard) | "Matters to James" must be explicit, editable weights — and shown on screen, not buried. |

**Tension:** spectacle vs. truth. **Resolution:** the Truth HUD — every animation is annotated, the transcript is one button away, and the crown screen shows EV math, not just a body on the floor.

## Presentation rules

- Original art only. Fighters are wing-coded masked avatars (palette swaps + wing sigils) — no likenesses of real people, no borrowed characters, logos, or trademark callouts.
- Living (or uncertain) figures (`Genius.living`): no body gore; finishers shatter the *position*.
- Callouts are our own: ARGUE! / SOUND! / FALLACY! / POSITION BROKEN / THE COUNCIL DECIDES.

## Phases

1. **Arcade Shell** (in progress) — 320×224 native buffer, integer scaling, fixed-step loop, title/attract, genius select by wing, VS, fight with pixel avatars, blood/sparks/shake/hitstop, synthesized SFX, council ladder + live EV board, crown screen.
2. **Feel pass** — full animation sets per `CombatEventType`, per-wing parallax arenas, chiptune, announcer voice, gamepad, combo/juggle tuning, secrets (hidden seats, arena finishers).
3. **Decision Lab** — problem intake, value-weight editor, status-quo baseline, sensitivity analysis ("which weight flips the verdict?"), exportable decision record.
4. **Agent Arena** — plug any model/endpoint as a fighter; ladder with Elo, fallacy rate, soundness, reward; regression runs in CI.
5. **Calibration loop** — decision journal: resolve predicted outcomes later, Brier-score seats and agents, feed credibility priors back into the council.
6. **Other uses** — judge benchmarking, pre-mortems/red-teaming, negotiation and interview rehearsal, classroom debate mode, prompt A/B tests, model-upgrade regression checks.
