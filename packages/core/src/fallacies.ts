/**
 * The fallacy taxonomy.
 *
 * Canon: "Logical fallacies manifest as misses, whiffs, blocks, or staggers."
 * Each fallacy carries combat semantics: how it fails on screen, and whether
 * it backfires (self-damage to the attacker's credibility, e.g. ad hominem).
 */

export type FallacyId =
  | 'strawman'
  | 'ad_hominem'
  | 'appeal_to_authority'
  | 'appeal_to_emotion'
  | 'false_dilemma'
  | 'slippery_slope'
  | 'circular_reasoning'
  | 'hasty_generalization'
  | 'red_herring'
  | 'tu_quoque'
  | 'non_sequitur'
  | 'equivocation'
  | 'appeal_to_popularity'
  | 'moving_goalposts'
  | 'begging_the_question';

/** How a fallacy renders in combat when the judge catches it. */
export type FallacyFailureMode =
  | 'whiff'          // attacker swings at empty air
  | 'labeled_block'  // defender blocks; fallacy name flashes over the block
  | 'backfire';      // attacker stumbles and takes chip damage to own credibility

export interface FallacyDef {
  id: FallacyId;
  /** Display name flashed on screen, e.g. "STRAWMAN". */
  label: string;
  description: string;
  failureMode: FallacyFailureMode;
  /** Chip damage to the attacker when failureMode is 'backfire'. */
  backfireDamage: number;
}

export const FALLACIES: Record<FallacyId, FallacyDef> = {
  strawman: {
    id: 'strawman',
    label: 'STRAWMAN',
    description: 'Attacking a distorted version of the opponent’s position.',
    failureMode: 'labeled_block',
    backfireDamage: 0,
  },
  ad_hominem: {
    id: 'ad_hominem',
    label: 'AD HOMINEM',
    description: 'Attacking the arguer instead of the argument.',
    failureMode: 'backfire',
    backfireDamage: 4,
  },
  appeal_to_authority: {
    id: 'appeal_to_authority',
    label: 'APPEAL TO AUTHORITY',
    description: 'Citing status rather than evidence or reasoning.',
    failureMode: 'whiff',
    backfireDamage: 0,
  },
  appeal_to_emotion: {
    id: 'appeal_to_emotion',
    label: 'APPEAL TO EMOTION',
    description: 'Substituting feeling for reasoning.',
    failureMode: 'whiff',
    backfireDamage: 0,
  },
  false_dilemma: {
    id: 'false_dilemma',
    label: 'FALSE DILEMMA',
    description: 'Presenting two options as the only options.',
    failureMode: 'labeled_block',
    backfireDamage: 0,
  },
  slippery_slope: {
    id: 'slippery_slope',
    label: 'SLIPPERY SLOPE',
    description: 'Claiming one step inevitably cascades to catastrophe without support.',
    failureMode: 'whiff',
    backfireDamage: 0,
  },
  circular_reasoning: {
    id: 'circular_reasoning',
    label: 'CIRCULAR REASONING',
    description: 'The conclusion is smuggled into the premises.',
    failureMode: 'labeled_block',
    backfireDamage: 0,
  },
  hasty_generalization: {
    id: 'hasty_generalization',
    label: 'HASTY GENERALIZATION',
    description: 'Concluding from too small a sample.',
    failureMode: 'whiff',
    backfireDamage: 0,
  },
  red_herring: {
    id: 'red_herring',
    label: 'RED HERRING',
    description: 'Diverting to an irrelevant issue.',
    failureMode: 'whiff',
    backfireDamage: 0,
  },
  tu_quoque: {
    id: 'tu_quoque',
    label: 'TU QUOQUE',
    description: 'Deflecting criticism by pointing at the critic’s hypocrisy.',
    failureMode: 'backfire',
    backfireDamage: 3,
  },
  non_sequitur: {
    id: 'non_sequitur',
    label: 'NON SEQUITUR',
    description: 'The conclusion does not follow from the premises.',
    failureMode: 'whiff',
    backfireDamage: 0,
  },
  equivocation: {
    id: 'equivocation',
    label: 'EQUIVOCATION',
    description: 'Shifting the meaning of a key term mid-argument.',
    failureMode: 'labeled_block',
    backfireDamage: 0,
  },
  appeal_to_popularity: {
    id: 'appeal_to_popularity',
    label: 'APPEAL TO POPULARITY',
    description: 'Everyone believes it, therefore it is true.',
    failureMode: 'whiff',
    backfireDamage: 0,
  },
  moving_goalposts: {
    id: 'moving_goalposts',
    label: 'MOVING GOALPOSTS',
    description: 'Raising the standard of evidence after it has been met.',
    failureMode: 'labeled_block',
    backfireDamage: 0,
  },
  begging_the_question: {
    id: 'begging_the_question',
    label: 'BEGGING THE QUESTION',
    description: 'Assuming the very point under dispute.',
    failureMode: 'labeled_block',
    backfireDamage: 0,
  },
};
