/**
 * LlmJudge — production path for Phase 1 (real minds).
 *
 * Provider-agnostic: bind any chat-completion API by implementing ChatClient
 * (same seam as LlmAgent). The model is asked to return a structured JSON
 * verdict matching JudgeVerdict so the combat mapper and RL reward signal
 * stay deterministic downstream.
 *
 * Use ScriptAwareJudge as the golden oracle when calibrating: run both over
 * the same DebateScript and diff fallacies / soundness.
 */

import type { ArgumentEvent, FallacyId, JudgeVerdict } from '@vk/core';
import type { ChatClient, ChatMessage } from '@vk/debate';
import type { Judge } from './judge.js';

const FALLACY_IDS: FallacyId[] = [
  'strawman',
  'ad_hominem',
  'appeal_to_authority',
  'appeal_to_emotion',
  'false_dilemma',
  'slippery_slope',
  'circular_reasoning',
  'hasty_generalization',
  'red_herring',
  'tu_quoque',
  'non_sequitur',
  'equivocation',
  'appeal_to_popularity',
  'moving_goalposts',
  'begging_the_question',
];

const SYSTEM_PROMPT = [
  'You are the Judge in Verbal Kombat — impartial, never tired, never asleep.',
  'Evaluate a single debate utterance. Return ONLY a JSON object with these keys:',
  '  soundness (0..1), relevance (0..1), evidence (0..1), structure (0..1),',
  '  fallacies (array of fallacy ids), rebuttalForce (0..1), rationale (one short sentence).',
  `Allowed fallacy ids: ${FALLACY_IDS.join(', ')}.`,
  'Empty fallacies array means the argument is clean.',
  'rebuttalForce is high only when the utterance decisively dismantles a prior opposing claim.',
  'Do not invent fallacies. Prefer under-calling to over-calling.',
  'No markdown, no prose outside the JSON object.',
].join('\n');

function clamp01(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function parseFallacies(raw: unknown): FallacyId[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(FALLACY_IDS);
  const out: FallacyId[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && set.has(item as FallacyId)) {
      out.push(item as FallacyId);
    }
  }
  return out;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Prefer fenced or bare object; strip common model noise.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1]!.trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('LlmJudge: no JSON object in model response');
  return JSON.parse(candidate.slice(start, end + 1));
}

export class LlmJudge implements Judge {
  readonly kind = 'llm';

  constructor(
    private readonly client: ChatClient,
    private readonly opts: { temperature?: number; maxTokens?: number } = {},
  ) {}

  async evaluate(arg: ArgumentEvent, history: ArgumentEvent[]): Promise<JudgeVerdict> {
    const historyBlock =
      history.length === 0
        ? '(none — this is an opening move)'
        : history
            .map((h) => `[${h.side}] ${h.text}`)
            .join('\n');

    const user: ChatMessage = {
      role: 'user',
      content: [
        'Debate so far (oldest first):',
        historyBlock,
        '',
        `Current utterance to judge (side ${arg.side}):`,
        arg.text,
        '',
        'Respond with the JSON verdict only.',
      ].join('\n'),
    };

    const raw = await this.client.complete(
      [{ role: 'system', content: SYSTEM_PROMPT }, user],
      {
        maxTokens: this.opts.maxTokens ?? 400,
        temperature: this.opts.temperature ?? 0.2,
      },
    );

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(raw) as Record<string, unknown>;
    } catch {
      // Soft floor: treat unparseable output as a weak clean argument rather than crashing the match.
      return {
        argumentId: arg.id,
        side: arg.side,
        soundness: 0.4,
        relevance: 0.5,
        evidence: 0.3,
        structure: 0.3,
        fallacies: [],
        rebuttalForce: 0,
        rationale: 'Judge response unparseable; applied neutral floor scores.',
      };
    }

    const fallacies = parseFallacies(parsed.fallacies);
    return {
      argumentId: arg.id,
      side: arg.side,
      soundness: clamp01(parsed.soundness),
      relevance: clamp01(parsed.relevance),
      evidence: clamp01(parsed.evidence),
      structure: clamp01(parsed.structure),
      fallacies,
      rebuttalForce: clamp01(parsed.rebuttalForce),
      rationale:
        typeof parsed.rationale === 'string' && parsed.rationale.trim()
          ? parsed.rationale.trim().slice(0, 280)
          : fallacies.length > 0
            ? `Fallacies: ${fallacies.join(', ')}.`
            : 'Clean argument.',
    };
  }
}
