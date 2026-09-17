/**
 * VERBAL KOMBAT — Arcade Shell (Phase 1).
 * Entry point for arcade.html.
 */

import { Game } from './engine.js';
import { TitleScreen } from './screens/menus.js';

const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
if (!canvas) throw new Error('arcade: #screen canvas missing');
const liveStatus = document.getElementById('arcade-status');

const game = new Game(canvas);
game.go(new TitleScreen(), true);
game.start();

canvas.addEventListener('pointerdown', () => canvas.focus());
canvas.focus();

const SCREEN_STATUS: Record<string, string> = {
  title: 'Title screen. Press Enter, Space, or Z to continue to mode select.',
  mode: 'Mode select. Use arrows to choose Exhibition or Council. Press Enter to confirm.',
  select: 'Genius select. Use arrows to choose each player and press Enter to lock in.',
  ladder: 'Council ladder screen. Press Enter to start the highlighted council bout.',
  evboard: 'Council EV board. Review calibrated expected values and continue to the next bout.',
  crown: 'Council crown results screen. Press Enter to return to title.',
  vs: 'Versus screen. Press Enter to begin the announced matchup.',
  fight: 'Fight playback screen. Press P to pause and review the transcript.',
  result: 'Result screen. Press Enter to return to selection.',
};

let announced = '';
const syncLiveStatus = () => {
  const status = SCREEN_STATUS[game.screenName] ?? `Screen ${game.screenName}.`;
  if (liveStatus && status !== announced) {
    liveStatus.textContent = status;
    announced = status;
  }
  requestAnimationFrame(syncLiveStatus);
};
syncLiveStatus();

// Read-only probe for automated smoke tests.
(window as unknown as { __arcade?: unknown }).__arcade = {
  get screen() {
    return game.screenName;
  },
  get current() {
    return game.current;
  },
  get tick() {
    return game.tick;
  },
};
