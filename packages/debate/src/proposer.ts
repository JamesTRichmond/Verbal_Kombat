/**
 * Proposers — how a seated genius turns the problem into a proposal.
 *
 * Before the council fights, each seat applies its wing's move to the
 * problem and returns an answer plus the outcomes it predicts, each with a
 * probability and a per-criterion impact on the owner's value profile.
 */

import {
  WINGS,
  getGenius,
  type Proposal,
  type ProposalOutcome,
  type ValueProfile,
} from '@vk/core';
import type { ChatClient } from './llm.js';

export interface ProposalContext {
  problem: string;
  seat: string; // genius slug
  profile: ValueProfile;
}

export interface ProposalAgent {
  readonly kind: string;
  propose(ctx: ProposalContext): Promise<Proposal>;
}

/** Deterministic proposals for demos and tests. */
export class ScriptedProposer implements ProposalAgent {
  readonly kind = 'scripted';
  constructor(private readonly bySeat: Record<string, Omit<Proposal, 'seat'>>) {}

  async propose(ctx: ProposalContext): Promise<Proposal> {
    const p = this.bySeat[ctx.seat];
    if (!p) throw new Error(`No scripted proposal for seat ${ctx.seat}`);
    return { seat: ctx.seat, ...p };
  }
}

export const GENIUS_GUARDRAIL =
  'You argue with this thinker\'s METHOD applied to the live problem. Never quote them, never speak as them, never claim they would endorse your conclusion.';

export function proposalSystemPrompt(ctx: ProposalContext): string {
  const g = getGenius(ctx.seat);
  const w = WINGS[g.wing];
  const criteria = ctx.profile.criteria.map((c) => `- ${c.id}: ${c.label} (weight ${c.weight})`).join('\n');
  return [
    `You are a seat on a council of geniuses. Your lens: ${g.name} (${w.name}).`,
    `Your move: ${w.move}. Your question: ${w.question}`,
    `Your method: ${g.method}${g.contested ? ' This is a contested lens — say so if it carries weight.' : ''}`,
    GENIUS_GUARDRAIL,
    `You are answering for ${ctx.profile.ownerName}. What matters to them:`,
    criteria,
    'Return ONLY JSON: {"answer": string (1-2 lines), "reasoning": string (how your move produced it, 1-3 lines),',
    '"outcomes": [{"description": string, "probability": 0..1, "impacts": {<criterion id>: -1..1}}]}.',
    'List 2-4 outcomes including the realistic bad one. Probabilities must be honest; you will be cross-examined and broken positions get discounted.',
  ].join('\n');
}

export class LlmProposer implements ProposalAgent {
  readonly kind = 'llm';
  constructor(private readonly client: ChatClient) {}

  async propose(ctx: ProposalContext): Promise<Proposal> {
    const raw = await this.client.complete(
      [
        { role: 'system', content: proposalSystemPrompt(ctx) },
        { role: 'user', content: `Problem: ${ctx.problem}` },
      ],
      { maxTokens: 700, temperature: 0.6 },
    );
    return parseProposal(raw, ctx.seat);
  }
}

/** Tolerant JSON extraction; malformed output becomes a zero-EV proposal rather than a crash. */
export function parseProposal(raw: string, seat: string): Proposal {
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const obj = JSON.parse(match?.[0] ?? '') as Partial<Proposal>;
    const outcomes: ProposalOutcome[] = Array.isArray(obj.outcomes)
      ? obj.outcomes
          .filter((o): o is ProposalOutcome => typeof o?.description === 'string')
          .map((o) => ({
            description: o.description,
            probability: Number(o.probability) || 0,
            impacts: Object.fromEntries(
              Object.entries(o.impacts ?? {}).map(([k, v]) => [k, Number(v) || 0]),
            ),
          }))
      : [];
    return {
      seat,
      answer: String(obj.answer ?? '').trim() || '(no answer)',
      reasoning: String(obj.reasoning ?? '').trim(),
      outcomes,
    };
  } catch {
    return { seat, answer: '(unparseable proposal)', reasoning: raw.slice(0, 200), outcomes: [] };
  }
}
