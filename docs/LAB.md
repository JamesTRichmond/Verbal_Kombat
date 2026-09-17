# The Lab — `@vk/lab`

The lab is the headless side of Verbal Kombat, with no rendering. It uses the same pipeline as the arcade (agents → judge → combat → replay) for two jobs:

1. **Deciding between options (Decision Lab).** A council of genius lenses proposes answers. The lenses fight, and the crown goes to the highest calibrated EV. Every answer also has to beat a *do nothing* baseline.
2. **Testing AI agents (Agent Arena).** Any chat model can be entered as a fighter. The arena reports win rate, soundness, fallacy rate, RL reward and Elo for each entrant.

## Commands

```bash
npm run lab -- decide packages/lab/examples/problem.json --offline [--mode quick|council|full] [--out report.md] [--journal journal.json]
npm run lab -- arena  packages/lab/examples/arena.json  --offline
npm run lab -- brier  journal.json
npm run lab -- roster init | roster [--top N] | fighter <slug>      # careers in data/fighters (--dir to change)
npm run lab -- train --offline [--bouts N] [--seed S] [--pairing random|weakest-vs-strongest|wing-rivals|least-fought] [--now ISO]
```

`decide` and `arena` accept `--roster <dir>`. With it, genius fighters fight as their grown selves and save what they learn after every bout. See [GROWTH.md](GROWTH.md).

- `--offline` runs `MockChatClient` for agents together with `HeuristicJudge`. It is deterministic, needs no keys, and is the mode CI should use.
- Without `--offline` the lab calls an OpenAI-compatible endpoint (`OpenAiChatClient`), configured through these environment variables:
  - `VK_API_KEY` (or `OPENAI_API_KEY`)
  - `VK_BASE_URL` (or `OPENAI_BASE_URL`)
  - `VK_PROPOSER_MODEL` — optional stronger model used only for the proposals (the bouts keep `VK_MODEL`)
  - `VK_MODEL` (or `OPENAI_MODEL`, default `gpt-4o-mini`)
  - `VK_JUDGE_MODELS`: a comma-separated list. Naming more than one model creates an `EnsembleJudge` of `LlmJudge`s.

  In an arena file, each entrant can override `model`, `baseUrl` and `apiKeyEnv`.

### `decide` input

The input file has these fields: `problem`, `profile` (owner value criteria and weights), and optionally `mode`, `seats` (genius slugs), `prefer`, `homeWing`, `statusQuo` (a custom baseline proposal) and `maxTurns`.

The output is a markdown report containing:
- the verdict
- EV compared with the status quo
- standings
- sensitivity: which single weight, halved or doubled, changes the champion
- the predictions to resolve later

### `arena` input

The input file has `topics` (`{topic, stances: {A, B}}`), `entrants` (`{id, archetypeId?, mock?, model?}`), and optionally `rounds` and `maxTurns`. Every pair of entrants debates every topic from both sides. Elo is updated in match order.

## Plugging in an agent

Implement `ChatClient` from `@vk/debate`:

```ts
const myAgent: ChatClient = {
  async complete(messages, opts) { return callMyModel(messages, opts); },
};
await benchmarkAgents({ entrants: [{ id: 'mine', client: myAgent }, { id: 'baseline', client: other }], topics, judge });
```

The fighter's archetype (`ROSTER` id or `genius:<slug>`) shapes the system prompt that `LlmAgent` sends. A fine-tuned checkpoint connects through the same seam, and `avgReward` is the `rewardSignal` the RL harness optimizes.

## Closing the calibration loop

1. Run `decide --journal journal.json`. This saves a `DecisionRecord` containing every seat's predicted outcomes and their probabilities.
2. Later, call `journal.resolveOutcome(recordId, seat, outcomeIndex, happened)` for each outcome, then save the journal.
3. `brierScores()` gives each seat the mean squared error between the probability it claimed and what actually happened. Lower is better.
4. `credibilityPriors()` maps each Brier score to a prior between 0 and 1 (`1 − brier`). The next `decide` run with `--journal` passes these priors to `runDecision`, which blends them into the credibility a seat earns in its fights (`priorWeight`, default 0.3). Seats that predicted well get more benefit of the doubt; seats that predicted badly get less.
