# Swarm Mode — the Council of Geniuses

Verbal Kombat, fused with the Swarm of Geniuses method. 186 historical thinkers become fighters. Every seat proposes an answer to the owner's problem, the seats fight, and the crown goes to the answer with the highest **calibrated expected value for the owner**.

## The idea in one line

The blood on screen is the cross-examination of each proposal; the winner is not whoever survives, but whoever proposes the answer that is most likely to go well *for James*, after the fights have stripped out the overconfident claims.

## The twelve wings are the fighting styles

| Wing | Move | Style (dominant traits) | Characteristic failure |
|---|---|---|---|
| Questioners | Examine the assumption | interrogation | begging the question |
| Lawfinders | Find the invariant | formalism, patience | hasty generalization |
| Pattern-Seers | See the hidden sameness | formalism | equivocation |
| Formalizers | Make it an exact procedure | formalism | false dilemma |
| Experimenters | Let evidence outrank rank | empiricism | hasty generalization |
| Imaginers | Run it forward in the mind | rhetoric | slippery slope |
| Builders | Make the smallest real thing | empiricism, aggression | false cause |
| Strategists | Play against the best reply | aggression | false dilemma, strawman |
| Mind-Mappers | Model the minds involved | interrogation, rhetoric | ad hominem |
| Awakeners | Return to what is here | patience | appeal to emotion |
| Society-Shapers | Weigh who gains and who pays | balanced | appeal to popularity |
| Artists | Give it a form people feel | rhetoric | appeal to emotion |

A genius = wing traits (how it fights) + its one-line method (what it argues with). Data lives in `@vk/core/geniuses.ts`.

## The match flow

```
problem ──▶ seatCouncil ──▶ Proposer (per seat) ──▶ Proposal { answer, outcomes[p, impacts] }
                                                     │
            round robin: every pair fights, stance = own proposal
                                                     │
            runMatch ──▶ replays ──▶ credibilityFrom × outcomeCredibilitiesFrom ──▶ scoreProposal ──▶ crownCouncil
```

Seating follows the swarm's rules: quick = 3 seats, council = 7, full = 12 (one per wing). Always a Questioner, a reality tether (Experimenter), the human side (Awakener), and a wildcard from the wing farthest from the problem's home field. No two seats from the same wing.

## The scoring

For each outcome a proposal predicts:

- `p` = the seat's claimed probability
- `m` = how much it matters to the owner = Σ (criterion weight × impact), impacts −1..1
- `c_seat` = credibility the seat earned in its fights (integrity kept, bouts won, fallacies avoided)
- `c_k` = `c_seat` × per-outcome credibility. Clean opponent rebuttals that name an outcome adjust only that outcome: beneficial outcomes are discounted, while harmful outcomes can be reinforced (so warnings about risk do not accidentally reward the proposal). Fallacious swings do not count.

Calibration:

- `p' = c_k·p + (1−c_k)·0.2` — a broken *outcome* regresses toward doubt
- `m' = c_k·m` — a broken outcome can't vouch for its own stakes
- **EV = Σ p' × m'** — highest wins

`fightsChangedTheAnswer` flags when the loudest raw claim lost the crown. That flag is the product's proof of value.

## The owner's value profile

`OWNER_DRAFT_PROFILE` is a placeholder with five criteria (AI career pivot, income, sustainable energy cost, craft, people). James sets the real criteria and weights in the setup flow; nothing here claims to know them.

## Guardrails (carried from the swarm)

- Methods, never impersonation: no quotes, no speaking as the person, no implied endorsement. Enforced in both the proposer and debate system prompts.
- Contested lenses (Freud, Jaynes, Langan) are labeled contested.
- Health, legal, and financial problems get the council's thinking plus a pointer to a qualified professional (to wire into the proposer prompt when Problem intake ships).

## Built in this slice

- `@vk/core/geniuses.ts` — 12 wings, 186 geniuses, `geniusArchetype()`
- `@vk/core/council.ts` — value profile, EV math, credibility, seating, round robin, crown
- `@vk/core/council.ts` — `outcomeCredibilitiesFrom`: targeted clean rebuttals adjust only that outcome (including harmful-outcome warnings)
- `@vk/debate/proposer.ts` — `ProposalAgent`, `ScriptedProposer`, `LlmProposer`, tolerant JSON parsing
- `@vk/replay/council-runner.ts` — `runCouncil` orchestrator with `onProposal / onBoutStart / onExchange / onBout` hooks
- Tests for all of the above
- Fighter growth: every genius keeps a career (XP, levels, lessons, individual log) that only ever grows — see [GROWTH.md](GROWTH.md)

## Next

1. Game UI: council setup screen (problem, mode, value weights), bracket view, EV leaderboard that moves as bouts resolve.
2. Live wiring: `LlmProposer` + `LlmAgent` + judge ensemble through the existing OpenAI client.
3. Bout budget: council mode is 21 bouts — add a cap / Swiss pairing option.
4. Synthesis finisher: the champion's closing argument must absorb the strongest dissent (feeds `resolveProblemOutcome`).
