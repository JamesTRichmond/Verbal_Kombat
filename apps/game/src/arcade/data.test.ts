import { describe, expect, it } from 'vitest';
import { OWNER_DRAFT_PROFILE, getGenius, scoreProposal, type MatchReplay, type Proposal, type TranscriptEntry } from '@vk/core';
import { evSnapshot, type CouncilPlay } from './data.js';

function replay(entries: TranscriptEntry[]): MatchReplay {
  const stat = { arguments: 2, cleanHits: 1, fallacies: 0, avgSoundness: 0.8, totalDamageDealt: 20 };
  return {
    config: { id: 'r', topic: 't', stances: { A: 'a', B: 'b' }, fighters: { A: 'x', B: 'y' }, mode: 'problem' },
    entries,
    winner: 'B',
    finalIntegrity: { A: 30, B: 80 },
    stats: { A: stat, B: stat },
  };
}

const targetedSeat: Proposal = {
  seat: 'socrates',
  answer: 'Take the moonshot despite the risks.',
  reasoning: 'The upside is worth concentrated execution.',
  outcomes: [
    { description: 'Regulatory fine risk', probability: 0.6, impacts: { income: -1 } },
    { description: 'Burnout risk', probability: 0.7, impacts: { energy: -1 } },
    { description: 'Moonshot windfall', probability: 0.4, impacts: { income: 0.8, career: 0.8 } },
  ],
};

const challenger: Proposal = {
  seat: 'marie-curie',
  answer: 'Pilot the idea first.',
  reasoning: 'Run the experiment first.',
  outcomes: [{ description: 'Steady measurable progress', probability: 0.7, impacts: { career: 0.6, income: 0.5, energy: 0.2 } }],
};

function playWith(entry: TranscriptEntry): CouncilPlay {
  const seats = [getGenius('socrates'), getGenius('marie-curie')];
  return {
    problem: 'Should James go all in on the moonshot?',
    result: {
      seats,
      proposals: [targetedSeat, challenger],
      bouts: [{ id: 'b1', A: 'socrates', B: 'marie-curie', replay: replay([entry]) }],
      verdict: {
        champion: scoreProposal(challenger, OWNER_DRAFT_PROFILE, 1),
        standings: [
          scoreProposal(challenger, OWNER_DRAFT_PROFILE, 1),
          scoreProposal(targetedSeat, OWNER_DRAFT_PROFILE, 1),
        ],
        loudestClaim: 'socrates',
        fightsChangedTheAnswer: true,
      },
    },
    bouts: [{
      id: 'b1',
      A: seats[0]!,
      B: seats[1]!,
      replay: replay([entry]),
      arena: 'warroom',
      learned: {} as CouncilPlay['bouts'][number]['learned'],
    }],
  };
}

describe('evSnapshot', () => {
  it('carries mixed target directions into arcade EV snapshots without touching siblings', () => {
    const text = 'The regulatory fine risk is real, but the burnout risk is implausible.';
    const plain = playWith({
      argument: { id: 'u1', matchId: 'r', side: 'B', text, seq: 1, t: 1 },
      verdict: {
        argumentId: 'u1',
        side: 'B',
        soundness: 0.8,
        relevance: 0.8,
        evidence: 0.7,
        structure: 0.7,
        fallacies: [],
        rebuttalForce: 0.8,
        rebuttalDirection: 'unclear',
        rebuttalTargets: [],
        rationale: text,
      },
      combat: [],
    });
    const targeted = playWith({
      argument: { id: 'u1', matchId: 'r', side: 'B', text, seq: 1, t: 1 },
      verdict: {
        argumentId: 'u1',
        side: 'B',
        soundness: 0.8,
        relevance: 0.8,
        evidence: 0.7,
        structure: 0.7,
        fallacies: [],
        rebuttalForce: 0.8,
        rebuttalDirection: 'unclear',
        rebuttalTargets: [
          { outcome: 'Regulatory fine risk', direction: 'supports' },
          { outcome: 'Burnout risk', direction: 'challenges' },
        ],
        rationale: text,
      },
      combat: [],
    });
    const plainScore = evSnapshot(plain, 1).find((score) => score.seat === 'socrates')!;
    const targetedScore = evSnapshot(targeted, 1).find((score) => score.seat === 'socrates')!;
    expect(targetedScore.outcomes[0]!.riskSupport).toBeGreaterThan(0);
    expect(targetedScore.outcomes[0]!.calibratedProbability * targetedScore.outcomes[0]!.calibratedMatters)
      .toBeLessThan(plainScore.outcomes[0]!.calibratedProbability * plainScore.outcomes[0]!.calibratedMatters);
    expect(targetedScore.outcomes[1]!.credibility).toBeLessThan(plainScore.outcomes[1]!.credibility);
    expect(targetedScore.outcomes[1]!.calibratedProbability * targetedScore.outcomes[1]!.calibratedMatters)
      .toBeGreaterThan(plainScore.outcomes[1]!.calibratedProbability * plainScore.outcomes[1]!.calibratedMatters);
    expect(targetedScore.outcomes[2]).toEqual(plainScore.outcomes[2]);
  });
});
