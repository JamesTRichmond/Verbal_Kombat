/**
 * The demo fixture: a scripted debate with authored ground-truth
 * annotations, including deliberate fallacies on both sides so every
 * combat event type appears in the demo match.
 *
 * Side A: Socrates Prime — free will is an illusion.
 * Side B: Silver Tongue — free will is real.
 */

import type { DebateScript } from '../scripted.js';

export const FREE_WILL: DebateScript = {
  topic: 'This house believes free will is an illusion.',
  stances: {
    A: 'Free will is an illusion; every choice is the product of prior causes.',
    B: 'Free will is real; human beings genuinely originate their choices.',
  },
  lines: [
    {
      side: 'A',
      text: 'Every event we have ever observed has a cause. A decision is an event in a brain. Therefore every decision has a cause that precedes the chooser\'s awareness of choosing.',
      annotations: { soundness: 0.85, evidence: 0.6 },
    },
    {
      side: 'B',
      text: 'Causation is not compulsion. A choice caused by my own reasons, weighed in my own deliberation, is still mine — the causal chain running through me is exactly what willing IS.',
      annotations: { soundness: 0.85, evidence: 0.5, rebuts: true },
    },
    {
      side: 'A',
      text: 'But your "deliberation" was itself caused — by genes, upbringing, and the brain state you did not choose. Trace any choice backward and you exit the self entirely.',
      annotations: { soundness: 0.8, evidence: 0.55, rebuts: true },
    },
    {
      side: 'B',
      text: 'Only a fool locked in a laboratory could believe something so bloodless — people who deny free will are simply afraid of responsibility.',
      annotations: { fallacies: ['ad_hominem'], soundness: 0.15 },
    },
    {
      side: 'A',
      text: 'Note what just happened: my character was attacked, my argument untouched. The regress stands. Where, precisely, in the causal chain does your "origination" occur?',
      annotations: { soundness: 0.8, rebuts: true },
    },
    {
      side: 'B',
      text: 'So you claim we are mere puppets who should empty the prisons and abandon all praise and blame — that is your position\'s true face.',
      annotations: { fallacies: ['strawman'], soundness: 0.2 },
    },
    {
      side: 'A',
      text: 'I claim no such thing; consequences of a thesis are not the thesis. Libet\'s readiness-potential experiments and their successors show preparatory brain activity preceding reported intention by hundreds of milliseconds.',
      annotations: { soundness: 0.75, evidence: 0.85, rebuts: true },
    },
    {
      side: 'B',
      text: 'Those experiments measure wrist-flick timing, not deliberation. Later work — Schurger\'s stochastic accumulator model — shows the readiness potential is background noise crossing a threshold, not a decision already made. The empirical sword cuts against you.',
      annotations: { soundness: 0.85, evidence: 0.9, rebuts: true },
    },
    {
      side: 'A',
      text: 'Everyone from Spinoza to Einstein has denied free will, so the educated consensus is settled.',
      annotations: { fallacies: ['appeal_to_authority', 'appeal_to_popularity'], soundness: 0.2 },
    },
    {
      side: 'B',
      text: 'Consensus is not proof, and you know it. Here is my structure, plainly: an action is free when it flows from the agent\'s own reasons, absent coercion; such actions occur; therefore free actions occur. Determinism is irrelevant to every premise.',
      annotations: { soundness: 0.9, evidence: 0.6, rebuts: true },
    },
    {
      side: 'A',
      text: 'Then observe where every path has led: you rescued "freedom" only by redefining it into something no one ever disputed. The freedom you began defending — the ability to have done otherwise — you have quietly abandoned; the regress stands unanswered; and a defense that survives only by changing the subject is a concession. The illusion is complete precisely because it feels so real.',
      annotations: { soundness: 0.9, evidence: 0.5, rebuts: true, isCloser: true },
    },
  ],
};
