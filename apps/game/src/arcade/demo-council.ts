/**
 * Authored demo council for the arcade shell.
 *
 * Three seats answer one problem. The seat with the loudest raw claim
 * (Sun Tzu's lens: "go all in, now") argues with fallacies, gets broken in
 * both of its bouts, and its credibility collapses — so the crown goes to a
 * quieter, better-defended answer. That is `fightsChangedTheAnswer`.
 *
 * Methods, never impersonation: every line argues a lens applied to the
 * problem; no line quotes or speaks as the real person.
 */

import type { ArgumentEvent, FallacyId, JudgeVerdict, Proposal } from '@vk/core';
import { OWNER_DRAFT_PROFILE } from '@vk/core';
import { ScriptedAgent, ScriptedProposer, type DebateAgent, type DebateScript } from '@vk/debate';
import type { Judge } from '@vk/judge';

export const COUNCIL_ID = 'council';
export const COUNCIL_PROBLEM = 'How should James spend the next 90 days to land applied AI work?';
export const COUNCIL_PROFILE = OWNER_DRAFT_PROFILE;

/** Seat order decides the round robin: (0,1) (0,2) (1,2). */
export const COUNCIL_SEATS = ['sun-tzu', 'socrates', 'john-carmack'] as const;

export const COUNCIL_PROPOSALS: Record<string, Omit<Proposal, 'seat'>> = {
  'sun-tzu': {
    answer: 'Go all in: drop side work, blitz fifty applications and a loud public launch inside 30 days.',
    reasoning: 'Shaped the contest as a single decisive push before rivals can react.',
    outcomes: [
      { description: 'The launch goes viral and offers pour in', probability: 0.85, impacts: { career: 1, income: 0.9, craft: 0.5 } },
      { description: 'Burnout from the blitz', probability: 0.1, impacts: { energy: -0.8 } },
    ],
  },
  socrates: {
    answer: 'First define the exact job in one sentence, then build only what proves you can do it.',
    reasoning: 'Examined the assumption that more output equals more progress.',
    outcomes: [
      { description: 'A focused proof lands the right interviews', probability: 0.6, impacts: { career: 0.9, income: 0.5, energy: 0.3 } },
      { description: 'The definition work feels slow at first', probability: 0.3, impacts: { craft: -0.2 } },
    ],
  },
  'john-carmack': {
    answer: 'Ship one small, measured AI tool every two weeks and publish the build notes.',
    reasoning: 'Found the binding constraint (visible proof of work) and built toward it in small steps.',
    outcomes: [
      { description: 'A trail of shipped tools draws inbound interest', probability: 0.55, impacts: { career: 0.8, craft: 0.7, income: 0.3 } },
      { description: 'A slow month with little attention', probability: 0.35, impacts: { income: -0.2, energy: 0.1 } },
    ],
  },
};

export interface CouncilLine {
  seat: string;
  text: string;
  annotations: {
    soundness: number;
    evidence?: number;
    fallacies?: FallacyId[];
    rebuts?: boolean;
    isCloser?: boolean;
  };
}

/** Bout scripts keyed by bout id (`council-bout1` …), in speaking order. */
export const COUNCIL_BOUTS: Record<string, CouncilLine[]> = {
  // Sun Tzu's lens vs Socrates' lens — the loud claim meets the question.
  [`${COUNCIL_ID}-bout1`]: [
    { seat: 'sun-tzu', text: 'Either James goes all in this month or he stays stuck on the sidelines forever. There is no third road.', annotations: { soundness: 0.2, fallacies: ['false_dilemma'] } },
    { seat: 'socrates', text: 'Two roads only? What of a focused month that is neither a blitz nor standing still? Name the job first, and the road picks itself.', annotations: { soundness: 0.85, evidence: 0.5, rebuts: true } },
    { seat: 'sun-tzu', text: 'So you would have him sit and philosophize while everyone else takes the jobs.', annotations: { soundness: 0.15, fallacies: ['strawman'] } },
    { seat: 'socrates', text: 'I said define, then build. A clear target shortens the build; it does not replace it. Fifty scattershot applications test nothing and prove nothing about fit.', annotations: { soundness: 0.85, evidence: 0.6, rebuts: true } },
    { seat: 'sun-tzu', text: 'Only someone who has never shipped anything would counsel this much patience.', annotations: { soundness: 0.1, fallacies: ['ad_hominem'] } },
    { seat: 'socrates', text: 'Look at what your case has become: a forced choice, a distorted opponent, and an insult. The eighty-five percent odds of a viral launch rest on none of it. A claim that cannot survive one question should not steer ninety days of a life.', annotations: { soundness: 0.9, evidence: 0.6, rebuts: true, isCloser: true } },
  ],
  // Sun Tzu's lens vs Carmack's lens — the blitz meets the build log.
  [`${COUNCIL_ID}-bout2`]: [
    { seat: 'sun-tzu', text: 'Every serious person in AI says launch loud. The crowd is never wrong about momentum.', annotations: { soundness: 0.2, fallacies: ['appeal_to_popularity'] } },
    { seat: 'john-carmack', text: 'Most launches get a day of attention and then vanish. Hiring managers read shipped code and write-ups; a steady trail of working tools is the evidence they check. Two-week cycles give eight measured shots in ninety days instead of one loud one.', annotations: { soundness: 0.85, evidence: 0.8 } },
    { seat: 'sun-tzu', text: 'A decisive push concentrates force where it matters; scattered effort is weak everywhere.', annotations: { soundness: 0.6, evidence: 0.3 } },
    { seat: 'john-carmack', text: 'Concentration is right, but the target is proof of skill, not noise. Each small tool concentrates on one skill a job needs.', annotations: { soundness: 0.85, evidence: 0.6, rebuts: true } },
    { seat: 'sun-tzu', text: 'If he ships small now, he will ship small forever and never be noticed by anyone.', annotations: { soundness: 0.15, fallacies: ['slippery_slope'] } },
    { seat: 'john-carmack', text: 'Starting small is how nearly every lasting tool began; the first version of a thing says nothing about its ceiling.', annotations: { soundness: 0.85, evidence: 0.6, rebuts: true } },
    { seat: 'sun-tzu', text: 'You are one to talk about patience when your own plan still has no launch date.', annotations: { soundness: 0.1, fallacies: ['tu_quoque'] } },
    { seat: 'john-carmack', text: 'Small releases compound: each one is measured, each write-up is searchable, and the eighth tool is built on the first seven. Nothing about starting small caps the finish. The blitz bets ninety days on one roll; the build log keeps every roll.', annotations: { soundness: 0.9, evidence: 0.7, rebuts: true, isCloser: true } },
  ],
  // Socrates' lens vs Carmack's lens — two defended answers, a close decision.
  [`${COUNCIL_ID}-bout3`]: [
    { seat: 'socrates', text: 'Build what, exactly? A tool with no named job behind it proves skill in general and fit in particular to no one.', annotations: { soundness: 0.8, evidence: 0.4 } },
    { seat: 'john-carmack', text: 'Shipping teaches what the job is. You find the target faster by building than by defining in the abstract.', annotations: { soundness: 0.65, evidence: 0.4, rebuts: true } },
    { seat: 'socrates', text: 'Then let the first build be the definition test: one sentence of the role, one tool that proves it, one hiring manager who reads it.', annotations: { soundness: 0.85, evidence: 0.5 } },
    { seat: 'john-carmack', text: 'Everyone I have seen get hired built a pile of projects first, so a pile is what works.', annotations: { soundness: 0.25, fallacies: ['hasty_generalization'] } },
    { seat: 'socrates', text: 'Some were hired with piles and some with a single sharp proof; the pile is not what they share. What they share is evidence aimed at a specific role.', annotations: { soundness: 0.85, evidence: 0.6, rebuts: true } },
    { seat: 'john-carmack', text: 'Fair. Aim first, then measure.', annotations: { soundness: 0.35, evidence: 0.1 } },
  ],
};

/**
 * Each play of the council gets a unique id (`council~<stamp>`) so fighter
 * logs never reuse a bout id; the authored scripts stay keyed by
 * `council-boutN`.
 */
export function councilPlayId(): string {
  return `${COUNCIL_ID}~${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function scriptKey(boutId: string): string {
  return boutId.replace(/~[^-]*/, '');
}

/** Bout scripts in the DebateScript shape (side A = first seat of the pair). */
function scriptFor(boutId: string): DebateScript {
  const lines = COUNCIL_BOUTS[scriptKey(boutId)] ?? [];
  const first = lines[0]?.seat;
  return {
    topic: COUNCIL_PROBLEM,
    stances: { A: '', B: '' },
    lines: lines.map((l) => ({ side: l.seat === first ? 'A' : 'B', text: l.text })),
  };
}

/** Council debater: each seat replays its authored lines for the bout. */
export function councilDebater(seatSlug: string, boutId: string, sideA: string): DebateAgent {
  return new ScriptedAgent(scriptFor(boutId), seatSlug === sideA ? 'A' : 'B');
}

function annotationFor(arg: ArgumentEvent): CouncilLine['annotations'] | undefined {
  return COUNCIL_BOUTS[scriptKey(arg.matchId)]?.find((l) => l.text === arg.text)?.annotations;
}

export function councilIsCloser(arg: ArgumentEvent): boolean {
  return annotationFor(arg)?.isCloser === true;
}

/** Reads the authored annotations — modeled on ScriptAwareJudge. */
export class CouncilScriptJudge implements Judge {
  readonly kind = 'council-script';

  async evaluate(arg: ArgumentEvent, _history: ArgumentEvent[]): Promise<JudgeVerdict> {
    const ann = annotationFor(arg);
    const fallacies = ann?.fallacies ?? [];
    const soundness = ann?.soundness ?? 0.6;
    return {
      argumentId: arg.id,
      side: arg.side,
      soundness,
      relevance: fallacies.includes('red_herring') ? 0.2 : 0.85,
      evidence: ann?.evidence ?? 0.4,
      structure: soundness,
      fallacies,
      rebuttalForce: ann?.rebuts && fallacies.length === 0 ? Math.min(1, soundness + 0.1) : 0,
      rationale:
        fallacies.length > 0
          ? `Authored ground truth: ${fallacies.join(', ').replace(/_/g, ' ')}.`
          : soundness >= 0.75
            ? 'Authored ground truth: sound and supported.'
            : 'Authored ground truth: clean but thin.',
    };
  }
}

export function councilProposer(): ScriptedProposer {
  return new ScriptedProposer(COUNCIL_PROPOSALS);
}
