/**
 * Keyboard + Gamepad input, sampled once per fixed update.
 * Actions are edge-triggered (`pressed`) with menu auto-repeat for held
 * directions; `onFirstInput` fires once to unlock audio (autoplay policy).
 */

export type Action = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause' | 'mute' | 'fast' | 'start';

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Enter: 'confirm', Space: 'confirm', KeyZ: 'confirm',
  Escape: 'back', Backspace: 'back', KeyX: 'back',
  KeyP: 'pause', KeyM: 'mute', KeyF: 'fast',
};

const REPEAT_DELAY = 18;
const REPEAT_RATE = 5;

export class Input {
  private queued = new Set<Action>();
  private now = new Set<Action>();
  private padHeld = new Map<Action, number>();
  private unlocked = false;
  private unlockHandlers: (() => void)[] = [];

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      this.unlock();
      if (!a) return;
      e.preventDefault();
      this.queued.add(a);
    });
    target.addEventListener('pointerdown', () => this.unlock());
  }

  onFirstInput(fn: () => void): void {
    if (this.unlocked) fn();
    else this.unlockHandlers.push(fn);
  }

  private unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    for (const fn of this.unlockHandlers) fn();
    this.unlockHandlers = [];
  }

  /** Call once per fixed update before screens read input. */
  poll(): void {
    this.now = this.queued;
    this.queued = new Set();
    this.pollPad();
  }

  pressed(a: Action): boolean {
    return this.now.has(a);
  }

  /** Confirm-like: confirm or start. */
  ok(): boolean {
    return this.now.has('confirm') || this.now.has('start');
  }

  private pollPad(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const held = new Set<Action>();
    for (const p of pads) {
      if (!p) continue;
      const b = (i: number) => p.buttons[i]?.pressed === true;
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      if (b(12) || ay < -0.5) held.add('up');
      if (b(13) || ay > 0.5) held.add('down');
      if (b(14) || ax < -0.5) held.add('left');
      if (b(15) || ax > 0.5) held.add('right');
      if (b(0)) held.add('confirm');
      if (b(1)) held.add('back');
      if (b(9)) held.add('start');
      if (b(8)) held.add('pause');
      if (b(3)) held.add('fast');
    }
    if (held.size > 0) this.unlock();
    for (const a of held) {
      const t = (this.padHeld.get(a) ?? -1) + 1;
      this.padHeld.set(a, t);
      const dir = a === 'up' || a === 'down' || a === 'left' || a === 'right';
      if (t === 0 || (dir && t >= REPEAT_DELAY && (t - REPEAT_DELAY) % REPEAT_RATE === 0)) this.now.add(a);
    }
    for (const a of [...this.padHeld.keys()]) if (!held.has(a)) this.padHeld.delete(a);
  }
}
