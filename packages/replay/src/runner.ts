/**
 * MatchRunner — the orchestrator that wires the whole pipeline together:
 *
 *   agents (A, B) → ArgumentEvents → Judge → CombatMapper → MatchState
 *                                       ↘ TranscriptEntry → MatchReplay
 *
 * The runner is renderer-agnostic: the demo app subscribes to onExchange to
 * animate, and the same runner powers headless self-play for the RL harness.
 */

import {
  newMatch,
  type ArgumentEvent,
  type CombatEvent,
  type JudgeVerdict,
  type MatchConfig,
  type MatchReplay,
  type MatchState,
  type Side,
  type TranscriptEntry,
} from '@vk/core';
import { applyVerdict } from '@vk/combat';
import type { DebateAgent } from '@vk/debate';
import type { FighterArchetype } from '@vk/core';
import type { Judge } from '@vk/judge';

export interface Exchange {
  argument: ArgumentEvent;
  verdict: JudgeVerdict;
  combat: CombatEvent[];
  state: MatchState;
}

export interface RunnerOptions {
  /** Debate-time ms between utterances (drives replay timestamps). */
  turnMs?: number;
  /** Hard cap on total utterances. */
  maxTurns?: number;
  /** Mark an utterance as a potential closer (finisher eligibility). */
  isCloser?: (arg: ArgumentEvent) => boolean;
  /** Archetypes per side, forwarded to agents that need them (LlmAgent). */
  archetypes?: Partial<Record<Side, FighterArchetype>>;
  onExchange?: (exchange: Exchange) => void | Promise<void>;
}

export async function runMatch(
  config: MatchConfig,
  agents: Record<Side, DebateAgent>,
  judge: Judge,
  opts: RunnerOptions = {},
): Promise<{ state: MatchState; replay: MatchReplay }> {
  const state = newMatch(config);
  const history: ArgumentEvent[] = [];
  const entries: TranscriptEntry[] = [];
  const turnMs = opts.turnMs ?? 1200;
  const maxTurns = opts.maxTurns ?? 60;

  let seq = 0;
  let current: Side = 'A';
  let consecutivePasses = 0;

  while (state.phase !== 'complete' && seq < maxTurns && consecutivePasses < 2) {
    const agent = agents[current];
    const archetype = opts.archetypes?.[current];
    const text = await agent.nextArgument({
      matchId: config.id,
      topic: config.topic,
      stance: config.stances[current],
      side: current,
      ...(archetype !== undefined ? { archetype } : {}),
      history,
    });

    if (text === null) {
      consecutivePasses++;
      current = current === 'A' ? 'B' : 'A';
      continue;
    }
    consecutivePasses = 0;

    const argument: ArgumentEvent = {
      id: `${config.id}-a${++seq}`,
      matchId: config.id,
      side: current,
      text,
      seq,
      t: seq * turnMs,
    };
    history.push(argument);

    const verdict = await judge.evaluate(argument, history.slice(0, -1));
    const combat = applyVerdict(state, argument, verdict, {}, opts.isCloser?.(argument) ?? false);

    const entry: TranscriptEntry = { argument, verdict, combat };
    entries.push(entry);
    await opts.onExchange?.({ argument, verdict, combat, state });

    current = current === 'A' ? 'B' : 'A';
  }

  // If no knockout, the side with more remaining integrity takes the decision.
  if (state.phase !== 'complete') {
    state.phase = 'complete';
    if (state.sides.A.integrity !== state.sides.B.integrity) {
      state.winner = state.sides.A.integrity > state.sides.B.integrity ? 'A' : 'B';
    }
  }

  const replay = buildReplay(config, state, entries);
  return { state, replay };
}

export function buildReplay(config: MatchConfig, state: MatchState, entries: TranscriptEntry[]): MatchReplay {
  const stats = { A: statsFor(entries, 'A'), B: statsFor(entries, 'B') };
  return {
    config,
    entries,
    ...(state.winner !== undefined ? { winner: state.winner } : {}),
    finalIntegrity: { A: state.sides.A.integrity, B: state.sides.B.integrity },
    ...(state.problemOutcome !== undefined ? { problemOutcome: state.problemOutcome } : {}),
    stats,
  };
}

function statsFor(entries: TranscriptEntry[], side: Side) {
  const own = entries.filter((e) => e.argument.side === side);
  const args = own.length;
  return {
    arguments: args,
    cleanHits: own.filter((e) => e.combat.some((c) => c.damage > 0)).length,
    fallacies: own.reduce((n, e) => n + e.verdict.fallacies.length, 0),
    avgSoundness: args === 0 ? 0 : own.reduce((n, e) => n + e.verdict.soundness, 0) / args,
    totalDamageDealt: own.reduce((n, e) => n + e.combat.reduce((m, c) => m + c.damage, 0), 0),
  };
}
