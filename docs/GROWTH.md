# Fighter Growth

Each of the 186 genius fighters has a career that lasts between sessions. A fighter earns XP, gains levels, and learns lessons from every bout, and the next bout it fights uses what it learned. The code is in `@vk/core/growth.ts`.

## How a fighter grows

After each bout, **both** fighters learn from it (`learnFromBout`).

- **XP.** A fighter gets the normal match award plus study XP: **+30** for each new lesson, **+8** for each lesson it already had and learned again, and **+40** for losing. XP never goes down.
- **Levels.** A fighter goes up one level for every 1,000 XP, starting at level 1.
- **Lessons.** Each lesson is written as an instruction the fighter can follow. There are four kinds:
  - `avoid_fallacy`: a fallacy the fighter committed ("Never use slippery slope… It cost you against Ramanujan.")
  - `counter`: an opposing argument that did real damage, which the fighter should prepare an answer for.
  - `technique`: after a loss or draw, the best move the opponent made. After a win, the fighter's own best move.
  - `blind_spot`: added after every loss. It names the fighter's weakest move so the fighter fixes it next time.
- **Wards.** Each time a fighter commits a fallacy, its resistance to that fallacy rises by 5%, up to a maximum of 50%. A ward lowers the fighter's risk of committing that fallacy.
- **Trait gains.** Style traits go up a little after each bout. A loser gains **+0.015** in the traits its opponent showed. A winner gains **+0.005** in the traits it used. Each trait can gain at most +0.25.
- **The loser always learns.** A loss always adds a blind-spot lesson and the loser's study XP. Losing teaches the most.

`grownArchetype(record)` returns the fighter as it fights now: the base style for its wing, plus its trait gains, minus the fallacy risk its wards remove. The fighter's title also shows its level.

## The additive guarantee

Growth can only add to a career:

- New lessons are appended to the list.
- If a fighter learns a lesson it already has, that lesson's `seen` count goes up. Lessons are never rewritten or removed.
- Every bout adds one entry to the fighter's log, and old entries stay as they are.
- XP, wards, and trait gains never go down.

Two storage layers enforce this rule. The lab's `FileFighterStore` refuses to save a record if its XP, log length, lesson count, or match count is lower than what's on disk, or if a lesson is missing or its `seen` count dropped. The arcade's store refuses the same kinds of losing writes. Records are saved atomically: the store writes a temp file and then renames it over the old one. A crash in the middle of a save therefore cannot cut off a career.

## Where careers live

- **Lab / repo:** `data/fighters/`
  - `<slug>.json` is the career record and the source of truth.
  - `<slug>.md` is the readable log. It is rebuilt every time the record is saved.
  - `README.md` is the standings table for all 186 fighters, ranked by level, then XP, then wins.
- **Arcade:** careers are stored in the browser (`localStorage`, key `vk.fighters.v1`). If the browser can't store them, the arcade keeps them in memory for the current session only.

## Commands

```bash
npm run lab -- roster init                  # create any missing careers (never overwrites) + standings
npm run lab -- roster --top 10              # print standings
npm run lab -- fighter albert-einstein      # print one fighter's log
npm run lab -- train --offline --bouts 60 --seed 42 --pairing weakest-vs-strongest --now 2026-09-16T12:00:00Z
npm run lab -- decide problem.json --offline --roster data/fighters   # council seats grow
npm run lab -- arena  arena.json   --offline --roster data/fighters   # genius:<slug> entrants grow
```

Each command takes `--dir <path>` (default `data/fighters`) to use a different roster folder.

`train` runs self-play bouts between geniuses. The run is reproducible when you pass `--seed` and `--now`. The `--pairing` option chooses how fighters are matched:

- `random`: any two fighters.
- `weakest-vs-strongest`: a fighter from the bottom quarter of the standings against one from the top quarter.
- `wing-rivals`: two fighters from two different wings.
- `least-fought`: the two fighters with the fewest bouts meet, so the whole roster levels evenly.

Topics come from `packages/lab/examples/topics.json`, or from the file you pass with `--topics`.

With `--offline`, fighters are played by the mock client. Each genius has a fixed temperament, so some start out sloppier than others. Each `avoid_fallacy` lesson in a fighter's prompt lowers its fallacy rate, so you can watch offline fighters improve. Without `--offline`, the command uses the same environment-configured model as `decide`.

The committed roster came from `roster init` followed by the 60-bout command shown above.

## How lessons reach the model

Before a bout, `lessonsForPrompt(record, { opponent })` picks up to 8 lessons in this order:

1. Fallacies to avoid.
2. Counters, with lessons about the current opponent first.
3. Blind spots.
4. Techniques.

Within each group, lessons learned more often come first. The runner passes the selected lessons to the agent (`RunnerOptions.lessons`). The agent adds them to its **system prompt** under the heading "Lessons from your earlier bouts (apply them)". Council proposers also get them when they write their proposals. What a fighter has learned changes how it argues in the next bout.
