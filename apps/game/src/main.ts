/**
 * VERBAL KOMBAT — demo client with the full match ritual.
 *
 * Flow (the MK ceremony, re-derived for debate — docs/UI-REFERENCE.md):
 *   CHOOSE FIGHTERS → VS (stances as tale-of-the-tape) → ARENA CARD
 *   → ROUND 1 → ARGUE! → the fight → FINISH THE ARGUMENT → FATALITY
 *   → REPORT CARD → STUDY THE TRANSCRIPT (replay scrubber)
 */

import {
  ROSTER,
  xpForMatch,
  type CombatEvent,
  type FighterArchetype,
  type MatchReplay,
  type Side,
  type TranscriptEntry,
} from '@vk/core';
import { FREE_WILL, ScriptedAgent } from '@vk/debate';
import { ScriptAwareJudge } from '@vk/judge';
import { runMatch } from '@vk/replay';

/* ------------------------------------------------------------------ */
/* Match computation                                                   */
/* ------------------------------------------------------------------ */

const ARENA_NAME = 'THE COURTROOM OF CAUSATION';

async function computeMatch(fighters: Record<Side, string>): Promise<MatchReplay> {
  const config = {
    id: 'demo',
    topic: FREE_WILL.topic,
    stances: FREE_WILL.stances,
    fighters,
    mode: 'exhibition' as const,
  };
  const isCloser = (a: { text: string }) =>
    FREE_WILL.lines.find((l) => l.text === a.text)?.annotations?.isCloser === true;
  const { replay } = await runMatch(
    config,
    { A: new ScriptedAgent(FREE_WILL, 'A'), B: new ScriptedAgent(FREE_WILL, 'B') },
    new ScriptAwareJudge(FREE_WILL),
    { isCloser },
  );
  return replay;
}

/* ------------------------------------------------------------------ */
/* DOM handles                                                         */
/* ------------------------------------------------------------------ */

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $('#arena') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const transcriptEl = $('#transcript');
const verdictEl = $('#verdict');
const btnFight = $('#btn-fight') as HTMLButtonElement;
const scrub = $('#scrub') as unknown as HTMLInputElement;
const scrubLabel = $('#scrub-label');
const overlay = $('#overlay');
const comboEls: Record<Side, HTMLElement> = { A: $('#combo-a'), B: $('#combo-b') };
const clockNum = $('#clock-num');

$('#topic').textContent = `“${FREE_WILL.topic}”`;
