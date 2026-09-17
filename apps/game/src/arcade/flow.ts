/** Navigation between screens (kept in one place to avoid import tangles). */

import { getGenius, type Genius } from '@vk/core';
import { ARENA_FOR_WING } from './arenas.js';
import { computeCouncil, computeExhibition, EXHIBITION_STANCES, type CouncilPlay } from './data.js';
import type { Game } from './engine.js';
import { FightScreen } from './fight.js';
import { COUNCIL_PROPOSALS } from './demo-council.js';
import { CrownScreen, EvBoardScreen, LadderScreen } from './screens/council.js';
import { ResultScreen, VsScreen } from './screens/match.js';
import { ModeScreen, SelectScreen, TitleScreen } from './screens/menus.js';
import { HallScreen } from './screens/hall.js';
import { LearnedScreen } from './screens/learned.js';
import { learnBout, uniqueBoutId } from './careers.js';

export function toTitle(game: Game): void {
  game.go(new TitleScreen());
}

export function toMode(game: Game): void {
  game.go(new ModeScreen());
}

export function toSelect(game: Game): void {
  game.go(new SelectScreen());
}

export function toHall(game: Game): void {
  game.go(new HallScreen());
}

export function startExhibition(game: Game, a: Genius, b: Genius): void {
  const arena = ARENA_FOR_WING[a.wing];
  const load = computeExhibition(a.slug, b.slug);
  game.go(
    new VsScreen({
      A: a,
      B: b,
      stanceA: EXHIBITION_STANCES.A,
      stanceB: EXHIBITION_STANCES.B,
      title: 'EXHIBITION - FREE WILL',
      arena,
      load,
      onBack: toSelect,
      onReady: (g, replay) =>
        g.go(
          new FightScreen({
            replay,
            fighters: { A: a, B: b },
            arena,
            title: 'EXHIBITION',
            onDone: (gg, r) => {
              const learned = learnBout(r, { A: a.slug, B: b.slug }, uniqueBoutId(r.config.id));
              gg.go(
                new ResultScreen(r, { A: a, B: b }, (g3) =>
                  g3.go(new LearnedScreen({ A: a, B: b }, learned, 'EXHIBITION - FREE WILL', toTitle)),
                ),
              );
            },
          }),
        ),
    }),
  );
}

export function startCouncil(game: Game): void {
  // Fresh every play: each council teaches its seats and saves their careers.
  game.go(new LadderScreen(computeCouncil()));
}

export function councilBout(game: Game, play: CouncilPlay, k: number): void {
  const b = play.bouts[k];
  if (!b) {
    game.go(new CrownScreen(play));
    return;
  }
  const title = `COUNCIL BOUT ${k + 1}/${play.bouts.length}`;
  game.go(
    new VsScreen({
      A: b.A,
      B: b.B,
      stanceA: COUNCIL_PROPOSALS[b.A.slug]?.answer ?? '',
      stanceB: COUNCIL_PROPOSALS[b.B.slug]?.answer ?? '',
      title,
      arena: b.arena,
      load: Promise.resolve(b.replay),
      onBack: (g) => g.go(new LadderScreen(Promise.resolve(play), k)),
      onReady: (g, replay) =>
        g.go(
          new FightScreen({
            replay,
            fighters: { A: b.A, B: b.B },
            arena: b.arena,
            title,
            onDone: (gg) =>
              gg.go(
                new LearnedScreen({ A: b.A, B: b.B }, b.learned, title, (g3) => g3.go(new EvBoardScreen(play, k + 1))),
              ),
          }),
        ),
    }),
  );
}

export function geniusOrThrow(slug: string): Genius {
  return getGenius(slug);
}
