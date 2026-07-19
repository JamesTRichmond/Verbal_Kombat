# UI Reference — the Mortal Kombat presentation grammar

Reference material: SNES Mortal Kombat, Mortal Kombat II, and Mortal Kombat 3 (owner-provided copies, studied for interface conventions only). **We adopt the grammar — layout, flow, ceremony — never assets.** No sprites, art, audio, fonts, or code from the reference games may enter this repo.

The insight that makes these the right template: MK's interface is a **ritual**. Every match moves through the same ceremonial beats, and the player always knows exactly what phase they are in. Verbal Kombat keeps the ritual and re-derives every element from debate semantics.

## 1. The HUD (from all three games)

MK: two mirrored health bars at top with names inside the bars, round timer centered between them, round-win indicators beneath (MK3).

VK mapping:

| MK element | VK equivalent | Notes |
|---|---|---|
| Health bar | POSITION INTEGRITY bar | already implemented; name + stance inside the bar |
| Timer (99) | Debate clock | counts debate-time, not wall-clock; pauses during banners |
| Round-win pips | Resolution pips | a match is best-of-3 "clashes" on the same topic (see §4) |
| "DIZZY"/stun states | STAGGERED state | after a backfire: fighter visibly vulnerable, next clean hit vs them gets a damage bonus |

## 2. Combo popup (from MK3)

MK3 flashes "5 HIT COMBO" with an escalating counter at the side of the screen. VK: the combo popup names the structure — "3-LINK SYLLOGISM", "5-POINT CASE" — and on chain-break by fallacy, the popup shatters. This is the single highest-value borrow: it makes the *shape* of an argument legible at a glance.

## 3. Character select (from MKII/3)

MK: portrait grid, cursor per player, name callout on hover, mirrored select for P2.

VK select screen:
- Portrait grid of archetypes; hovering reads out name + title ("SOCRATES PRIME — THE INTERROGATOR").
- Instead of MK's silhouette bios: six **methodology trait bars** (interrogation, empiricism, formalism, rhetoric, aggression, patience) rendered like fighting-game stat bars, plus the archetype's characteristic fallacy risks shown as warning glyphs.
- Because v1 is AI-vs-AI, the user picks BOTH sides — the select flow is: Topic → Side A fighter + stance → Side B fighter + stance → VS screen.

## 4. Pre-fight ceremony (from all three)

MK sequence: character VS screen → arena card → "ROUND 1" → "FIGHT!"

VK sequence: **VS screen shows the two stances** as the tale-of-the-tape (topic centered, stance A vs stance B where MK shows records) → arena card names the topic domain ("THE COURTROOM OF CAUSATION") → "ROUND 1" → **"ARGUE!"**

## 5. Round flow and the finisher (from all three)

MK: KO → screen darkens, music stops, "FINISH HIM!" → fatality window (timed) → "FLAWLESS VICTORY" / "[NAME] WINS".

VK: integrity broken → arena darkens, transcript panel dims to a spotlight on the last exchange, **"FINISH THE ARGUMENT"** → the winning AI delivers its closing argument in the fatality window — if the judge scores it as true synthesis, the fatality plays (position visibly dismantled); if not, the match ends on a plain decision (deliberately anticlimactic — the game rewards the strong close):
- **FLAWLESS VICTORY** = victory with zero fallacies committed.
- **FATALITY subtitle** names the finishing move: "REGRESS COMPLETE", "PREMISES SEVERED", etc.

## 6. The tower / ladder (from MK1's endurance ladder)

MK: climb a ladder of opponents to the boss.

VK ranked mode: a fighter climbs a ladder of archetypes on randomized topics, culminating in the boss: **THE GRAND SOPHIST** — a boss who argues *brilliantly but dirtily*, weaponizing every fallacy in the taxonomy at maximum persuasiveness. Beating the Sophist means the fighter (and the model underneath) can defeat fallacious reasoning even when it is charismatic. This is the RL curriculum expressed as a boss fight.

## 7. Post-match (from MK3's stats + continue screens)

MK: victory pose, stats, continue countdown.

VK: victory pose → **match report card** (soundness average, fallacies committed with names, damage by argument class, XP breakdown from `xpForMatch`) → the annotated transcript viewer with the replay scrubber (already implemented). Where MK counts down to CONTINUE, VK offers "STUDY THE TRANSCRIPT".

## 8. Blood settings (from the MK1 blood-patch variant)

The uploaded blood-patch hack exists because SNES MK1 censored its gore and players wanted it back. Lesson: **the gore is the honesty of the medium**. VK's settings expose a "Rhetorical Gore" level (clinical → bloody) that scales particle intensity and fatality theatrics but NEVER changes the underlying verdicts — censoring the blood must not censor the judge.

## Implementation order

1. Combo/structure popup + STAGGERED state (pure renderer + one mapper flag)
2. Pre-fight ceremony (VS screen with stances, arena card, ARGUE!)
3. Character select with trait bars
4. Round pips / best-of-3 clashes
5. Match report card screen
6. Ladder mode + The Grand Sophist (needs live LLM agents first — Phase 1)
