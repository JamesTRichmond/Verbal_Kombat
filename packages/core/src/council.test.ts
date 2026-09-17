import { describe, expect, it } from 'vitest';
import {
  GENIUSES,
  WINGS,
  crownCouncil,
  credibilityFrom,
  farthestWing,
  geniusArchetype,
  mattersScore,
  outcomeCredibilitiesFrom,
  outcomeTokens,
  roundRobin,
  scoreProposal,
  seatCouncil,
  OWNER_DRAFT_PROFILE,
  type MatchReplay,
  type Proposal,
  type TranscriptEntry,
} from './index.js';

function replay(intA: number, intB: number, fallA = 0, entries: TranscriptEntry[] = []): MatchReplay {
  const stat = (f: number) => ({ arguments: 4, cleanHits: 2, fallacies: f, avgSoundness: 0.7, totalDamageDealt: 20 });
  return {
    config: { id: 'r', topic: 't', stances: { A: 'a', B: 'b' }, fighters: { A: 'x', B: 'y' }, mode: 'problem' },
    entries,
    ...(intA !== intB ? { winner: intA > intB ? ('A' as const) : ('B' as const) } : {}),
    finalIntegrity: { A: intA, B: intB },
    stats: { A: stat(fallA), B: stat(0) },
  };
}

function hit(
  text: string,
  force: number,
  fallacies: TranscriptEntry['verdict']['fallacies'] = [],
  rebuttalDirection?: TranscriptEntry['verdict']['rebuttalDirection'],
): TranscriptEntry {
  return {
    argument: { id: 'u1', matchId: 'r', side: 'B', text, seq: 1, t: 1 },
    verdict: {
      argumentId: 'u1',
      side: 'B',
      soundness: 0.8,
      relevance: 0.8,
      evidence: 0.7,
      structure: 0.7,
      fallacies,
      rebuttalForce: force,
      ...(rebuttalDirection ? { rebuttalDirection } : {}),
      rationale: text,
    },
    combat: [],
  };
}

describe('genius roster', () => {
  it('carries all 186 minds across 12 wings with unique slugs', () => {
    expect(GENIUSES.length).toBe(186);
    expect(new Set(GENIUSES.map((g) => g.slug)).size).toBe(186);
    expect(new Set(GENIUSES.map((g) => g.wing)).size).toBe(Object.keys(WINGS).length);
  });

  it('turns a genius into a fighter whose style is its wing', () => {
    const a = geniusArchetype('richard-feynman');
    expect(a.id).toBe('genius:richard-feynman');
    expect(a.traits.interrogation).toBe(WINGS.questioners.traits.interrogation);
    expect(geniusArchetype('sigmund-freud').description).toMatch(/Contested/);
  });
});

describe('seating', () => {
  it('quick mode seats a questioner, a reality tether, and the human side from 3 wings', () => {
    const seats = seatCouncil('quick');
    expect(seats.map((s) => s.wing)).toEqual(['questioners', 'experimenters', 'awakeners']);
  });

  it('council mode seats 7 distinct wings including a far-field wildcard', () => {
    const seats = seatCouncil('council', { homeWing: 'builders' });
    const wings = seats.map((s) => s.wing);
    expect(seats.length).toBe(7);
    expect(new Set(wings).size).toBe(7);
    expect(wings).toContain(farthestWing('builders', ['questioners', 'experimenters', 'awakeners']));
  });

  it('full mode seats one genius per wing', () => {
    expect(new Set(seatCouncil('full').map((s) => s.wing)).size).toBe(12);
  });

  it('honors a preferred genius without dropping the required seats', () => {
    const wings = seatCouncil('council', { prefer: ['sun-tzu'] });
    expect(wings.map((s) => s.slug)).toContain('sun-tzu');
    for (const w of ['questioners', 'experimenters', 'awakeners']) expect(wings.map((s) => s.wing)).toContain(w);
  });

  it('round robin pairs everyone once', () => {
    expect(roundRobin([1, 2, 3, 4, 5, 6, 7]).length).toBe(21);
  });
});

describe('expected value for the owner', () => {
  it('scores how much an outcome matters against the weighted profile', () => {
    const all = Object.fromEntries(OWNER_DRAFT_PROFILE.criteria.map((c) => [c.id, 1]));
    expect(mattersScore(OWNER_DRAFT_PROFILE, all)).toBeCloseTo(1);
    expect(mattersScore(OWNER_DRAFT_PROFILE, { career: 1 })).toBeCloseTo(3 / 12);
  });

  it('broken positions have their odds and stakes discounted', () => {
    const p: Proposal = {
      seat: 's',
      answer: 'a',
      reasoning: 'r',
      outcomes: [{ description: 'win', probability: 0.9, impacts: { career: 1, income: 1 } }],
    };
    const intact = scoreProposal(p, OWNER_DRAFT_PROFILE, 1);
    const broken = scoreProposal(p, OWNER_DRAFT_PROFILE, 0.2);
    expect(intact.calibratedEV).toBeCloseTo(intact.claimedEV);
    expect(broken.calibratedEV).toBeLessThan(intact.calibratedEV * 0.3);
  });

  it('credibility tracks integrity, wins, and fallacies', () => {
    const clean = credibilityFrom([{ seat: 's', replay: replay(80, 10), side: 'A' }]);
    const sloppy = credibilityFrom([{ seat: 's', replay: replay(80, 10, 4), side: 'A' }]);
    const beaten = credibilityFrom([{ seat: 's', replay: replay(0, 60), side: 'A' }]);
    expect(clean).toBeGreaterThan(sloppy);
    expect(sloppy).toBeGreaterThan(beaten);
  });

  it('the loudest claim loses the crown when its position gets broken', () => {
    const bold: Proposal = { seat: 'bold', answer: 'go all in', reasoning: '', outcomes: [{ description: 'jackpot', probability: 0.95, impacts: { income: 1, career: 1 } }] };
    const sober: Proposal = { seat: 'sober', answer: 'test small first', reasoning: '', outcomes: [{ description: 'steady gain', probability: 0.7, impacts: { income: 0.6, career: 0.6, energy: 0.4 } }] };
    const r = replay(5, 85); // bold (A) got dismantled by sober (B)
    const v = crownCouncil([bold, sober], OWNER_DRAFT_PROFILE, [
      { seat: 'bold', replay: r, side: 'A' },
      { seat: 'sober', replay: r, side: 'B' },
    ]);
    expect(v.loudestClaim).toBe('bold');
    expect(v.champion.seat).toBe('sober');
    expect(v.fightsChangedTheAnswer).toBe(true);
  });
});

describe('proposal-aware outcome credibility', () => {
  const two: Proposal = {
    seat: 's',
    answer: 'ship both bets',
    reasoning: '',
    outcomes: [
      { description: 'jackpot payout', probability: 0.9, impacts: { income: 1 } },
      { description: 'steady stipend', probability: 0.6, impacts: { income: 0.4, energy: 0.5 } },
    ],
  };

  it('tokenizes outcome descriptions without stopwords', () => {
    expect(outcomeTokens('jackpot payout after that')).toEqual(['jackpot', 'payout']);
  });

  it('a clean rebuttal that names one outcome discounts only that outcome', () => {
    const r = replay(70, 40, 0, [hit('the jackpot payout is a fantasy', 0.8)]);
    const oc = outcomeCredibilitiesFrom(two, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }]);
    expect(oc[0]).toBeLessThan(1);
    expect(oc[1]).toBe(1);
    const scored = scoreProposal(two, OWNER_DRAFT_PROFILE, 1, 0.2, oc);
    expect(scored.outcomes[0]!.credibility).toBeLessThan(scored.outcomes[1]!.credibility);
    expect(scored.outcomes[1]!.credibility).toBe(1);
  });

  it('does not match outcome tokens inside unrelated words', () => {
    const p: Proposal = {
      seat: 's',
      answer: 'a',
      reasoning: 'r',
      outcomes: [{ description: 'steady gain', probability: 0.5, impacts: { income: 1 } }],
    };
    const r = replay(70, 40, 0, [hit('I am against this plan', 0.9)]);
    const oc = outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }]);
    expect(oc).toEqual([1]);
  });

  it('clean warnings on harmful outcomes raise calibrated harm instead of softening it', () => {
    const p: Proposal = {
      seat: 's',
      answer: 'a',
      reasoning: 'r',
      outcomes: [{ description: 'regulatory fine risk', probability: 0.9, impacts: { income: -1 } }],
    };
    const r = replay(70, 40, 0, [hit('the regulatory fine risk is very likely', 0.8)]);
    const oc = outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }]);
    const plain = scoreProposal(p, OWNER_DRAFT_PROFILE, 0.2, 0.2, [1]);
    const warned = scoreProposal(p, OWNER_DRAFT_PROFILE, 0.2, 0.2, oc);
    expect(oc[0]).toBeGreaterThan(1);
    expect(warned.outcomes[0]!.riskSupport).toBeGreaterThan(0);
    expect(warned.calibratedEV).toBeLessThan(plain.calibratedEV);
  });

  it('keeps corroborated low-probability harms monotonic', () => {
    const p: Proposal = {
      seat: 's', answer: 'a', reasoning: 'r',
      outcomes: [{ description: 'rare regulatory fine', probability: 0.05, impacts: { income: -1 } }],
    };
    const r = replay(70, 40, 0, [hit('the rare regulatory fine is a genuine risk', 0.8, [], 'supports')]);
    const oc = outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }]);
    expect(scoreProposal(p, OWNER_DRAFT_PROFILE, 0.8, 0.2, oc).calibratedEV)
      .toBeLessThan(scoreProposal(p, OWNER_DRAFT_PROFILE, 0.8, 0.2, [1]).calibratedEV);
  });

  it('uses the judge direction when a harmful outcome is explicitly challenged', () => {
    const p: Proposal = {
      seat: 's', answer: 'a', reasoning: 'r',
      outcomes: [{ description: 'regulatory fine risk', probability: 0.8, impacts: { income: -1 } }],
    };
    const r = replay(70, 40, 0, [hit('the regulatory fine risk is real', 0.8, [], 'challenges')]);
    expect(outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }])[0]).toBeLessThan(1);
  });

  it('a challenge reduces rare harm without changing sibling outcomes', () => {
    const profile = { ownerId: 'o', ownerName: 'Owner', criteria: [{ id: 'income', label: 'Income', weight: 1 }] };
    const p: Proposal = {
      ...two,
      outcomes: [
        { description: 'rare regulatory fine', probability: 0.05, impacts: { income: -1 } },
        two.outcomes[1]!,
      ],
    };
    const r = replay(70, 40, 0, [hit('the rare regulatory fine is implausible', 0.8, [], 'challenges')]);
    const oc = outcomeCredibilitiesFrom(p, profile, [{ seat: 's', replay: r, side: 'A' }]);
    const plain = scoreProposal(p, profile, 1);
    const challenged = scoreProposal(p, profile, 1, 0.2, oc);
    const outcome = challenged.outcomes[0]!;
    expect(oc).toEqual([0.52, 1]);
    expect(outcome.calibratedProbability * outcome.calibratedMatters).toBeCloseTo(-0.026);
    expect(challenged.calibratedEV).toBeGreaterThan(plain.calibratedEV);
    expect(challenged.outcomes[1]).toEqual(plain.outcomes[1]);
  });

  it('stronger challenges never increase harm across probabilities, priors, and seat credibility', () => {
    for (const probability of [0, 0.05, 0.2, 0.8, 1]) {
      const p: Proposal = {
        ...two,
        outcomes: [{ description: 'regulatory fine', probability, impacts: { income: -1 } }],
      };
      for (const prior of [0, 0.2, 0.5, 1]) {
        for (const seatC of [0, 0.2, 0.8, 1]) {
          let previous = scoreProposal(p, OWNER_DRAFT_PROFILE, seatC, prior);
          for (const oc of [0.9, 0.52, 0.2, 0]) {
            const challenged = scoreProposal(p, OWNER_DRAFT_PROFILE, seatC, prior, [oc]);
            expect(challenged.calibratedEV).toBeGreaterThanOrEqual(previous.calibratedEV);
            previous = challenged;
          }
        }
      }
    }
  });

  it('does not use judge rationale to identify an outcome', () => {
    const entry = hit('that is unsupported', 0.8, [], 'challenges');
    entry.verdict.rationale = 'The jackpot payout is a fantasy';
    const r = replay(70, 40, 0, [entry]);
    expect(outcomeCredibilitiesFrom(two, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }])).toEqual([1, 1]);
  });

  it('uses only the utterance for legacy direction inference', () => {
    const p: Proposal = {
      ...two,
      outcomes: [{ description: 'regulatory fine risk', probability: 0.8, impacts: { income: -1 } }],
    };
    const entry = hit('the regulatory fine risk is real', 0.8);
    entry.verdict.rationale = 'The regulatory fine risk is implausible';
    const r = replay(70, 40, 0, [entry]);
    expect(outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }])[0]).toBeGreaterThan(1);
  });

  it.each([
    [1, 'the regulatory fine risk is real'],
    [-1, 'the regulatory fine risk is real'],
    [-1, 'the regulatory fine risk is implausible'],
  ])('leaves explicitly unclear outcomes unchanged (impact %s, %s)', (income, text) => {
    const p: Proposal = {
      ...two,
      outcomes: [{ description: 'regulatory fine risk', probability: 0.8, impacts: { income } }],
    };
    const r = replay(70, 40, 0, [hit(text, 0.8, [], 'unclear')]);
    expect(outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }])).toEqual([1]);
  });

  it('clamps accumulated evidence once, independently of transcript and bout order', () => {
    const p: Proposal = {
      ...two,
      outcomes: [{ description: 'regulatory fine risk', probability: 0.8, impacts: { income: -1 } }],
    };
    const support = hit('the regulatory fine risk is real', 1, [], 'supports');
    const challenge = hit('the regulatory fine risk is implausible', 1, [], 'challenges');
    for (const entries of [[support, support, challenge], [support, challenge, support], [challenge, support, support]]) {
      const together = [{ seat: 's', replay: replay(70, 40, 0, entries), side: 'A' as const }];
      const separate = entries.map((entry) => ({ seat: 's', replay: replay(70, 40, 0, [entry]), side: 'A' as const }));
      expect(outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, together)[0]).toBeCloseTo(1.024);
      expect(outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, separate)[0]).toBeCloseTo(1.024);
    }
    const r = replay(70, 40, 0, [support, support]);
    expect(outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }])).toEqual([2]);
  });

  it('does not target sibling outcomes using only shared proposal vocabulary', () => {
    const p: Proposal = {
      seat: 's', answer: 'a', reasoning: 'r',
      outcomes: [
        { description: 'Contract converts to a full-time AI role', probability: 0.5, impacts: { career: 1 } },
        { description: 'Contract ends with no follow-on', probability: 0.5, impacts: { income: -1 } },
      ],
    };
    const r = replay(70, 40, 0, [hit('however, this contract premise is weak', 0.8)]);
    expect(outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }])).toEqual([1, 1]);
  });

  it('clean rebuttals that dispute harmful outcomes cut their credibility instead of reinforcing them', () => {
    const p: Proposal = {
      seat: 's',
      answer: 'a',
      reasoning: 'r',
      outcomes: [{ description: 'regulatory fine risk', probability: 0.9, impacts: { income: -1 } }],
    };
    const r = replay(70, 40, 0, [hit('the regulatory\nfine risk for this plan is implausible', 0.8)]);
    const oc = outcomeCredibilitiesFrom(p, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }]);
    expect(oc[0]).toBeLessThan(1);
  });

  it('fallacious swings at an outcome do not cut its credibility', () => {
    const r = replay(70, 40, 0, [hit('jackpot payout is doomed', 0.9, ['ad_hominem'])]);
    const oc = outcomeCredibilitiesFrom(two, OWNER_DRAFT_PROFILE, [{ seat: 's', replay: r, side: 'A' }]);
    expect(oc).toEqual([1, 1]);
  });
});
