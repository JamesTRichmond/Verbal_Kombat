import { describe, expect, it } from 'vitest';
import { OWNER_DRAFT_PROFILE, getGenius, type Proposal } from '@vk/core';
import { ScriptedProposer, type DebateAgent } from '@vk/debate';
import { HeuristicJudge } from '@vk/judge';
import { MemoryFighterStore } from '@vk/replay';
import { decisionRecord, renderDecisionMarkdown, runDecision, STATUS_QUO_SEAT } from './decision.js';

const PROBLEM = 'Should James take the applied-AI contract or stay in his current role?';

const proposals: Record<string, Omit<Proposal, 'seat'>> = {
  socrates: {
    answer: 'Take the contract, but first define what success at month three looks like.',
    reasoning: 'Examined the assumption that a contract equals a pivot.',
    outcomes: [
      { description: 'Contract converts to a full-time AI role', probability: 0.5, impacts: { career: 0.9, income: 0.5 } },
      { description: 'Contract ends with no follow-on', probability: 0.4, impacts: { income: -0.6, energy: -0.2 } },
    ],
  },
  'marie-curie': {
    answer: 'Stay, and run a paid side project to measure demand first.',
    reasoning: 'Evidence before commitment.',
    outcomes: [
      { description: 'Side project finds paying users', probability: 0.4, impacts: { career: 0.5, income: 0.3, energy: -0.3 } },
      { description: 'Side project fizzles', probability: 0.6, impacts: { craft: 0.1, energy: -0.2 } },
    ],
  },
  'siddhartha-gautama': {
    answer: 'Stay and rest; the craving for a pivot is driving the anxiety.',
    reasoning: 'Traced the craving.',
    outcomes: [{ description: 'Calmer, steadier months', probability: 0.8, impacts: { energy: 0.9, people: 0.6, career: -0.2 } }],
  },
};

function debater(_seat: unknown, proposal: Proposal): DebateAgent {
  const lines = [
    `My position: ${proposal.answer} Because the data from comparable cases shows this path holds up, therefore it is the sound choice.`,
    `However, your premise ignores the evidence; therefore ${proposal.outcomes[0]?.description.toLowerCase()} is the likely result.`,
  ];
  let i = 0;
  return { kind: 'test', nextArgument: async () => lines[i++] ?? null };
}

const seats = ['socrates', 'marie-curie', 'siddhartha-gautama'].map(getGenius);

function decide(extra: Partial<Parameters<typeof runDecision>[0]> = {}) {
  return runDecision({
    id: 'd1',
    problem: PROBLEM,
    profile: OWNER_DRAFT_PROFILE,
    mode: 'quick',
    seats,
    proposer: new ScriptedProposer(proposals),
    debater,
    judge: new HeuristicJudge(),
    ...extra,
  });
}

describe('runDecision', () => {
  it('beats the default do-nothing baseline and reports sensitivity for every weight', async () => {
    const r = await decide();
    expect(r.baseline.seat).toBe(STATUS_QUO_SEAT);
    expect(r.baseline.credibility).toBe(0.5);
    expect(r.baseline.calibratedEV).toBe(0);
    expect(r.beatsStatusQuo).toBe(true);
    expect(r.champion.seat).toBe(r.standings[0]!.seat);
    expect(r.champion.calibratedEV).toBeGreaterThan(0);

    const n = OWNER_DRAFT_PROFILE.criteria.length;
    expect(r.sensitivity.length).toBe(n * 2);
    for (const s of r.sensitivity) {
      expect(['halve', 'double']).toContain(s.direction);
      expect(s.factor).toBe(s.direction === 'halve' ? 0.5 : 2);
      expect(seats.map((g) => g.slug)).toContain(s.champion);
      expect(s.flips).toBe(s.champion !== r.champion.seat);
    }
    expect(new Set(r.sensitivity.map((s) => s.criterionId))).toEqual(
      new Set(OWNER_DRAFT_PROFILE.criteria.map((c) => c.id)),
    );
  });

  it('can lose to a strong status quo', async () => {
    const r = await decide({
      statusQuo: {
        seat: STATUS_QUO_SEAT,
        answer: 'Stay put.',
        reasoning: 'Current role is great.',
        outcomes: [{ description: 'Promotion lands', probability: 1, impacts: { career: 1, income: 1, energy: 1, craft: 1, people: 1 } }],
      },
    });
    expect(r.beatsStatusQuo).toBe(false);
  });

  it('flags a weight that flips the verdict', async () => {
    // Doubling energy should favor the rest-and-recover seat.
    const r = await decide();
    const energyDouble = r.sensitivity.find((s) => s.criterionId === 'energy' && s.direction === 'double')!;
    if (energyDouble.flips) expect(energyDouble.champion).not.toBe(r.champion.seat);
    expect(typeof energyDouble.beatsStatusQuo).toBe('boolean');
  });

  it('credibility priors shift seat credibility', async () => {
    const plain = await decide();
    const primed = await decide({ credibilityPriors: { socrates: 0 }, priorWeight: 0.5 });
    expect(primed.credibility.socrates!).toBeLessThan(plain.credibility.socrates!);
    expect(primed.credibility['marie-curie']).toBe(plain.credibility['marie-curie']);
  });

  it('produces a JSON-serializable record and a markdown report', async () => {
    const r = await decide();
    const rec = decisionRecord(r, new Date('2026-01-02T03:04:05Z'));
    expect(JSON.parse(JSON.stringify(rec))).toEqual(rec);
    expect(rec.timestamp).toBe('2026-01-02T03:04:05.000Z');
    expect(rec.seats.map((s) => s.slug)).toEqual(seats.map((g) => g.slug));
    expect(rec.bouts.length).toBe(3);
    expect(rec.predictions.filter((p) => p.seat === 'socrates').length).toBe(2);
    expect(rec.predictions.some((p) => p.seat === STATUS_QUO_SEAT)).toBe(true);
    const md = renderDecisionMarkdown(rec);
    expect(md).toMatch(/^# Decision: /);
    expect(md).toMatch(/beats doing nothing/);
    expect(md).toMatch(/## Sensitivity/);
  });

  it('passes a fighter store through so seats learn from every bout', async () => {
    const fighters = new MemoryFighterStore();
    await decide({ fighters, runner: { now: () => new Date('2026-09-16T00:00:00Z') } });
    for (const g of seats) {
      const rec = fighters.get(g.slug);
      expect(rec.log).toHaveLength(2); // quick council of 3: each seat fights twice
      expect(rec.xp).toBeGreaterThan(0);
    }
  });
});
