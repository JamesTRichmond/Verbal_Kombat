/**
 * VERBAL KOMBAT — Arcade Shell (Phase 1).
 * Entry point for arcade.html.
 */

import { Game } from './engine.js';
import { TitleScreen } from './screens/menus.js';

const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
if (!canvas) throw new Error('arcade: #screen canvas missing');

const game = new Game(canvas);
game.go(new TitleScreen(), true);
game.start();

// Read-only probe for automated smoke tests.
(window as unknown as { __arcade?: unknown }).__arcade = {
  get screen() {
    return game.screenName;
  },
  get tick() {
    return game.tick;
  },
};
