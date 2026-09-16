import { describe, expect, it } from 'vitest';
import { OWNER_DRAFT_PROFILE, getGenius, type Proposal } from '@vk/core';
import { ScriptedProposer, parseProposal, proposalSystemPrompt, type DebateAgent } from '@vk/debate';
import { HeuristicJudge } from '@vk/judge';
import { runCouncil } from './council-runner.js';

const PROBLEM = 'Should James ship Verbal Kombat Council Mode as a portfolio piece this month?';

const proposals: Record<string, Omit<Proposal, 'seat'>> = {
  socrates: {
    answer: 'Ship only after defining what "done" means for a hiring manager.',
    reasoning: 'Examined the assumption that shipping equals progress.',
    outcomes: [
      { description: 'Clear demo that lands interviews', probability: 0.5, impacts: { career: 0.9, craft: 0.6 } },
      { description: 'Scope creep delays everything', probability: 0.3, impacts: { energy: -0.6 } },
    ],
  },
  'marie-curie': {
    answer: 'Ship a measured slice this week and track who engages with it.',
    reasoning: 'Let evidence outrank opinion: measure reactions before building more.',
    outcomes: [
      { description: 'Real signal from viewers', probability: 0.7, impacts: { career: 0.7, craft: 0.5, energy: 0.3 } },
      { description: 'Nobody looks', probability: 0.3, impacts: { craft: -0.2 } },
    ],
  },
  'siddhartha-gautama': {
    answer: 'Build it because the work itself satisfies; drop the deadline anxiety.',
    reasoning: 'Traced the craving behind the deadline.',
    outcomes: [{ description: 'Sustainable pace', probability: 0.8, impacts: { energy: 0.8, craft: 0.6 } }],
  },
};

/** Each seat argues its proposal in short, clean, evidence-flavored moves. */
function debater(_seat: unknown, proposal: Proposal): DebateAgent {
  const lines = [
    `My position: ${proposal.answer} Because ${proposal.reasoning.toLowerCase()} The data from comparable cases shows this path holds up.`,
    `Therefore, given the evidence, ${proposal.outcomes[0]?.description.toLowerCase()} is the most likely result.`,
  ];
  let i = 0;
  return { kind: 'test', nextArgument: async () => lines[i++] ?? null };
}

describe('runCouncil', () => {
  it('seats a quick council, fights a round robin, and crowns by calibrated EV', async () => {
    const seats = ['socrates', 'marie-curie', 'siddhartha-gautama'].map(getGenius);
    const bouts: string[] = [];
    const result = await runCouncil(
      { id: 'c1', problem: PROBLEM, profile: OWNER_DRAFT_PROFILE, mode: 'quick', seats },
      { proposer: new ScriptedProposer(proposals), debater, judge: new HeuristicJudge() },
      { onBout: (b) => void bouts.push(b.id) },
    );

    expect(result.proposals.length).toBe(3);
    expect(result.bouts.length).toBe(3);
    expect(bouts).toEqual(['c1-bout1', 'c1-bout2', 'c1-bout3']);
    expect(result.verdict.standings.length).toBe(3);
    const evs = result.verdict.standings.map((s) => s.calibratedEV);
    expect([...evs].sort((a, b) => b - a)).toEqual(evs);
    expect(result.verdict.champion.seat).toBe(result.verdict.standings[0]!.seat);
    // Fighters' stances are their own proposals.
    expect(result.bouts[0]!.replay.config.stances.A).toBe(proposals.socrates!.answer);
  });
});

describe('proposal parsing', () => {
  it('extracts JSON from chatty model output and survives garbage', () => {
    const ok = parseProposal('Sure! {"answer":"x","reasoning":"y","outcomes":[{"description":"d","probability":"0.4","impacts":{"career":0.5}}]}', 's');
    expect(ok.outcomes[0]!.probability).toBe(0.4);
    expect(parseProposal('no json here', 's').outcomes).toEqual([]);
  });

  it('prompts with the method and the no-impersonation guardrail', () => {
    const prompt = proposalSystemPrompt({ problem: PROBLEM, seat: 'julian-jaynes', profile: OWNER_DRAFT_PROFILE });
    expect(prompt).toMatch(/Never quote them/);
    expect(prompt).toMatch(/contested lens/);
    expect(prompt).toMatch(/career/);
  });
});
