/**
 * The CombatMapper — where verdicts become violence.
 *
 * Canon combat mapping:
 *   short clean factual point        → jab
 *   multi-premise constructed arg    → heavy attack
 *   points that build on each other  → combo chain
 *   devastating rebuttal             → launcher / knockdown
 *   fallacy                          → whiff / labeled block / backfire
 *   closing argument that lands      → finisher (fatality)
 *
 * "Good logic must feel physically powerful; fallacies must feel
 * physically costly."
 */

import {
  FALLACIES,
  MAX_INTEGRITY,
  opponent,
  type ArgumentEvent,
  type CombatEvent,
  type CombatEventType,
  type JudgeVerdict,
  type MatchState,
} from '@vk/core';

export interface MapperOptions {
  /** Damage scale knob for tuning match length. */
  damageScale?: number;
}

const HEAVY_LENGTH = 220; // chars — proxy for multi-premise construction in v0
const LAUNCHER_REBUTTAL_FORCE = 0.75;
const COMBO_WINDOW_SOUNDNESS = 0.6;

let eventCounter = 0;
function eventId(matchId: string): string {
  return `${matchId}-ce${++eventCounter}`;
}

/**
 * Map one judged argument to combat events and apply them to match state.
 * Mutates `state` (integrity, momentum, combos, counters) and returns the
 * events for the renderer + replay recorder.
 */
export function applyVerdict(
  state: MatchState,
  arg: ArgumentEvent,
  verdict: JudgeVerdict,
  opts: MapperOptions = {},
  isCloser = false,
): CombatEvent[] {
  const scale = opts.damageScale ?? 1;
  const actor = arg.side;
  const target = opponent(actor);
  const actorState = state.sides[actor];
  const targetState = state.sides[target];
  const events: CombatEvent[] = [];
  state.clock = arg.t;

  /* ---- Fallacious utterance: the attack fails. ---- */
  if (verdict.fallacies.length > 0) {
    actorState.combo = 0;
    actorState.fallaciesCommitted += verdict.fallacies.length;
    actorState.momentum = Math.max(-1, actorState.momentum - 0.3);

    // The dominant (first) fallacy decides the failure animation.
    const primaryId = verdict.fallacies[0];
    const primary = primaryId !== undefined ? FALLACIES[primaryId] : undefined;
    const mode = primary?.failureMode ?? 'whiff';

    const type: CombatEventType =
      mode === 'backfire' ? 'backfire' : mode === 'labeled_block' ? 'labeled_block' : 'whiff';
    const selfDamage = mode === 'backfire' ? (primary?.backfireDamage ?? 0) * scale : 0;

    actorState.integrity = Math.max(0, actorState.integrity - selfDamage);

    events.push({
      id: eventId(state.config.id),
      matchId: state.config.id,
      type,
      actor,
      damage: 0,
      selfDamage,
      label:
        mode === 'labeled_block'
          ? `${primary?.label ?? 'FALLACY'} — BLOCKED`
          : (primary?.label ?? 'FALLACY'),
      combo: 0,
      sourceArgumentId: arg.id,
      t: arg.t,
    });
    finishIfBroken(state);
    return events;
  }

  /* ---- Clean utterance: the attack lands (or guards). ---- */
  const quality = verdict.soundness * 0.5 + verdict.evidence * 0.2 + verdict.structure * 0.2 + verdict.relevance * 0.1;

  let type: CombatEventType;
  if (verdict.rebuttalForce >= LAUNCHER_REBUTTAL_FORCE) type = 'launcher';
  else if (arg.text.length >= HEAVY_LENGTH) type = 'heavy';
  else if (quality >= 0.45) type = 'jab';
  else type = 'guard';

  // Combo: consecutive clean, sound arguments from the same side chain.
  if (type !== 'guard' && verdict.soundness >= COMBO_WINDOW_SOUNDNESS) {
    actorState.combo += 1;
    if (actorState.combo > 1) type = type === 'launcher' ? 'launcher' : 'combo_hit';
  } else if (type === 'guard') {
    actorState.combo = 0;
  }

  const base = { jab: 6, heavy: 12, combo_hit: 8, launcher: 16, guard: 0, finisher: 0 }[type as string] ?? 0;
  const comboBonus = actorState.combo > 1 ? Math.min(6, (actorState.combo - 1) * 2) : 0;
  let damage = Math.round((base * (0.5 + quality) + comboBonus) * scale);

  /* ---- The finisher: only lands when the closer truly synthesizes. ---- */
  if (isCloser && targetState.integrity - damage <= Math.max(12, MAX_INTEGRITY * 0.15)) {
    type = 'finisher';
    damage = targetState.integrity; // the position comes spectacularly apart
  }

  targetState.integrity = Math.max(0, targetState.integrity - damage);
  if (damage > 0) actorState.cleanHits += 1;
  actorState.momentum = Math.min(1, actorState.momentum + damage / 25);
  state.sides[target].momentum = Math.max(-1, state.sides[target].momentum - damage / 30);

  events.push({
    id: eventId(state.config.id),
    matchId: state.config.id,
    type,
    actor,
    damage,
    selfDamage: 0,
    ...(type === 'combo_hit' || (type === 'launcher' && actorState.combo > 1)
      ? { label: `COMBO x${actorState.combo}` }
      : type === 'finisher'
        ? { label: 'FATALITY — POSITION DISMANTLED' }
        : type === 'launcher'
          ? { label: 'DEVASTATING REBUTTAL' }
          : {}),
    combo: actorState.combo,
    sourceArgumentId: arg.id,
    t: arg.t,
  });

  finishIfBroken(state);
  return events;
}

function finishIfBroken(state: MatchState): void {
  for (const side of ['A', 'B'] as const) {
    if (state.sides[side].integrity <= 0 && state.phase !== 'complete') {
      state.phase = 'complete';
      state.winner = opponent(side);
    }
  }
}

/** Reset the module-level event id counter (test isolation). */
export function _resetEventIds(): void {
  eventCounter = 0;
}
