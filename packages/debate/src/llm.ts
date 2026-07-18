/**
 * LlmAgent — the production path: a real model debates.
 *
 * Provider-agnostic: bind any chat-completion API by implementing ChatClient.
 * The system prompt is synthesized from the archetype's style traits, so the
 * fighter the user picked genuinely shapes HOW the model argues — canon:
 * "the fighter is a debate methodology wearing a body."
 *
 * This is also the seam where the self-play RL harness attaches: the same
 * ChatClient interface can wrap a locally fine-tuned model checkpoint, and
 * rewardSignal() from @vk/core scores each episode.
 */

import type { DebateAgent, DebateContext } from './agent.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatClient {
  complete(messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<string>;
}

export function styleSystemPrompt(ctx: DebateContext): string {
  if (!ctx.archetype) throw new Error('LlmAgent requires an archetype in the DebateContext');
  const t = ctx.archetype.traits;
  const emphases: string[] = [];
  if (t.interrogation > 0.7) emphases.push('Press with pointed questions that expose hidden assumptions.');
  if (t.empiricism > 0.7) emphases.push('Ground every claim in concrete evidence, data, or documented cases.');
  if (t.formalism > 0.7) emphases.push('Structure arguments as explicit premises leading to a conclusion.');
  if (t.rhetoric > 0.7) emphases.push('Argue with vivid, persuasive language and memorable framing.');
  if (t.patience > 0.7) emphases.push('Build long, careful multi-premise structures across turns.');
  if (t.aggression > 0.7) emphases.push('Keep relentless pressure on the weakest point of the opposing case.');

  return [
    `You are ${ctx.archetype!.name}, "${ctx.archetype!.title}" — a debate fighter in Verbal Kombat.`,
    `Debate topic: ${ctx.topic}`,
    `Your stance, which you must defend: ${ctx.stance}`,
    `Your method: ${ctx.archetype!.description}`,
    ...emphases,
    'Rules: argue soundly. Logical fallacies are punished — they cause your attacks to miss.',
    'Respond with a single argumentative move (1-4 sentences). Directly engage the most recent opposing point when one exists.',
  ].join('\n');
}

export class LlmAgent implements DebateAgent {
  readonly kind = 'llm';

  constructor(
    private readonly client: ChatClient,
    private readonly opts: { maxTurns?: number } = {},
  ) {}

  async nextArgument(ctx: DebateContext): Promise<string | null> {
    const ownTurns = ctx.history.filter((h) => h.side === ctx.side).length;
    if (ownTurns >= (this.opts.maxTurns ?? 12)) return null;

    const messages: ChatMessage[] = [
      { role: 'system', content: styleSystemPrompt(ctx) },
      ...ctx.history.map(
        (h): ChatMessage => ({
          role: h.side === ctx.side ? 'assistant' : 'user',
          content: h.text,
        }),
      ),
    ];
    if (messages.length === 1) {
      messages.push({ role: 'user', content: 'Present your opening argument.' });
    }

    const text = await this.client.complete(messages, { maxTokens: 300, temperature: 0.8 });
    return text.trim() || null;
  }
}
