/**
 * The Swarm of Geniuses — 186 historical minds as fighters.
 *
 * Canon extension (docs/SWARM-MODE.md): every genius is a METHOD wearing a
 * body, never an impersonation. The fighter argues with the genius's move
 * applied to the live problem; it never quotes, channels, or speaks for the
 * real person, and a living person's lens implies no endorsement.
 *
 * Each genius belongs to one of twelve wings. The wing sets the fighter's
 * StyleTraits and characteristic failure modes; the genius's one-line
 * method becomes its fighting description (and its LLM lens).
 */

import type { FallacyId } from './fallacies.js';
import type { FighterArchetype, StyleTraits } from './fighters.js';

export type WingId =
  | 'questioners'
  | 'lawfinders'
  | 'pattern_seers'
  | 'formalizers'
  | 'experimenters'
  | 'imaginers'
  | 'builders'
  | 'strategists'
  | 'mind_mappers'
  | 'awakeners'
  | 'society_shapers'
  | 'artists';

export interface Wing {
  id: WingId;
  name: string;
  /** The move every member of the wing makes. */
  move: string;
  /** The question the wing asks of any problem. */
  question: string;
  /** Default fighting style for the wing's members. */
  traits: StyleTraits;
  /** How this kind of mind characteristically fails. */
  fallacyRisk: Partial<Record<FallacyId, number>>;
  palette: { primary: string; secondary: string };
}

export const WINGS: Record<WingId, Wing> = {
  questioners: {
    id: 'questioners', name: 'The Questioners', move: 'Examine the assumption',
    question: 'What are we assuming, and is it true?',
    traits: { interrogation: 0.95, empiricism: 0.4, formalism: 0.6, rhetoric: 0.35, aggression: 0.5, patience: 0.7 },
    fallacyRisk: { begging_the_question: 0.08, moving_goalposts: 0.08 },
    palette: { primary: '#c9a227', secondary: '#3d3424' },
  },
  lawfinders: {
    id: 'lawfinders', name: 'The Lawfinders', move: 'Find the invariant',
    question: 'What stays constant no matter what?',
    traits: { interrogation: 0.5, empiricism: 0.7, formalism: 0.9, rhetoric: 0.2, aggression: 0.35, patience: 0.9 },
    fallacyRisk: { hasty_generalization: 0.1 },
    palette: { primary: '#5b7fd6', secondary: '#141c33' },
  },
  pattern_seers: {
    id: 'pattern_seers', name: 'The Pattern-Seers', move: 'See the hidden sameness',
    question: 'What is this secretly the same as?',
    traits: { interrogation: 0.45, empiricism: 0.5, formalism: 0.85, rhetoric: 0.3, aggression: 0.3, patience: 0.85 },
    fallacyRisk: { equivocation: 0.12, false_cause: 0.06 },
    palette: { primary: '#8e6bd6', secondary: '#1e1533' },
  },
  formalizers: {
    id: 'formalizers', name: 'The Formalizers', move: 'Make it an exact procedure',
    question: 'Can we write it as precise steps?',
    traits: { interrogation: 0.4, empiricism: 0.5, formalism: 0.95, rhetoric: 0.15, aggression: 0.4, patience: 0.8 },
    fallacyRisk: { false_dilemma: 0.06 },
    palette: { primary: '#6b9080', secondary: '#1c2621' },
  },
  experimenters: {
    id: 'experimenters', name: 'The Experimenters', move: 'Let evidence outrank rank',
    question: 'What does the evidence actually say?',
    traits: { interrogation: 0.5, empiricism: 0.95, formalism: 0.5, rhetoric: 0.2, aggression: 0.4, patience: 0.85 },
    fallacyRisk: { hasty_generalization: 0.12, appeal_to_authority: 0.06 },
    palette: { primary: '#2e86ab', secondary: '#12242e' },
  },
  imaginers: {
    id: 'imaginers', name: 'The Imaginers', move: 'Run it forward in the mind',
    question: 'What happens if we play this out?',
    traits: { interrogation: 0.5, empiricism: 0.45, formalism: 0.45, rhetoric: 0.75, aggression: 0.55, patience: 0.5 },
    fallacyRisk: { slippery_slope: 0.2, appeal_to_ignorance: 0.08 },
    palette: { primary: '#d67b2e', secondary: '#33200f' },
  },
  builders: {
    id: 'builders', name: 'The Builders', move: 'Make the smallest real thing',
    question: 'What can we build and test today?',
    traits: { interrogation: 0.35, empiricism: 0.8, formalism: 0.55, rhetoric: 0.3, aggression: 0.7, patience: 0.55 },
    fallacyRisk: { false_cause: 0.1, hasty_generalization: 0.08 },
    palette: { primary: '#b5651d', secondary: '#2b1a0c' },
  },
  strategists: {
    id: 'strategists', name: 'The Strategists', move: 'Play against the best reply',
    question: 'What is the strongest move against us?',
    traits: { interrogation: 0.55, empiricism: 0.5, formalism: 0.6, rhetoric: 0.45, aggression: 0.9, patience: 0.6 },
    fallacyRisk: { false_dilemma: 0.14, strawman: 0.1 },
    palette: { primary: '#8b1e1e', secondary: '#240808' },
  },
  mind_mappers: {
    id: 'mind_mappers', name: 'The Mind-Mappers', move: 'Model the minds involved',
    question: 'What are the minds here actually doing?',
    traits: { interrogation: 0.7, empiricism: 0.6, formalism: 0.4, rhetoric: 0.6, aggression: 0.35, patience: 0.7 },
    fallacyRisk: { ad_hominem: 0.1, appeal_to_emotion: 0.1 },
    palette: { primary: '#3fa38b', secondary: '#0f2922' },
  },
  awakeners: {
    id: 'awakeners', name: 'The Awakeners', move: 'Return to what is here',
    question: 'What is here before the story starts?',
    traits: { interrogation: 0.75, empiricism: 0.3, formalism: 0.3, rhetoric: 0.6, aggression: 0.15, patience: 0.95 },
    fallacyRisk: { appeal_to_emotion: 0.12, circular_reasoning: 0.08 },
    palette: { primary: '#d9cfae', secondary: '#2e2b22' },
  },
  society_shapers: {
    id: 'society_shapers', name: 'The Society-Shapers', move: 'Weigh who gains and who pays',
    question: 'Who benefits, who pays, and is it fair?',
    traits: { interrogation: 0.6, empiricism: 0.55, formalism: 0.55, rhetoric: 0.6, aggression: 0.45, patience: 0.7 },
    fallacyRisk: { appeal_to_popularity: 0.1, tu_quoque: 0.08 },
    palette: { primary: '#4a6fa5', secondary: '#111a29' },
  },
  artists: {
    id: 'artists', name: 'The Artists', move: 'Give it a form people feel',
    question: 'What form makes this felt?',
    traits: { interrogation: 0.3, empiricism: 0.3, formalism: 0.35, rhetoric: 0.95, aggression: 0.6, patience: 0.5 },
    fallacyRisk: { appeal_to_emotion: 0.22, red_herring: 0.12 },
    palette: { primary: '#a4243b', secondary: '#2b0d13' },
  },
};

export const WING_ORDER: WingId[] = [
  'questioners', 'lawfinders', 'pattern_seers', 'formalizers', 'experimenters', 'imaginers',
  'builders', 'strategists', 'mind_mappers', 'awakeners', 'society_shapers', 'artists',
];

export interface Genius {
  slug: string;
  name: string;
  wing: WingId;
  /** The essence of the method, paraphrased from public work. */
  method: string;
  /** Contested idea: stays a lens, labeled contested when it carries weight. */
  contested?: boolean;
  /**
   * Living (or recently deceased — treated as living when uncertain).
   * Presentation rule: no likeness, no body gore; finishers shatter the
   * POSITION, never the person.
   */
  living?: boolean;
}

export const GENIUSES: Genius[] = [
  { slug: "arthur-schopenhauer", name: "Arthur Schopenhauer", wing: "questioners", method: "Find the blind will behind every goal, expect want to become boredom, and answer with compassion." },
  { slug: "averroes", name: "Averroes (Ibn Rushd)", wing: "questioners", method: "Rank arguments by rigor, trace disputes to their roots, and reinterpret texts that demonstration contradicts." },
  { slug: "david-hume", name: "David Hume", wing: "questioners", method: "Weigh belief by evidence, treat forecasts as habit, and catch every leap from is to ought." },
  { slug: "friedrich-nietzsche", name: "Friedrich Nietzsche", wing: "questioners", method: "Trace where a value came from and whom it serves, then choose what you'd relive forever." },
  { slug: "kant", name: "Immanuel Kant", wing: "questioners", method: "Map what the mind brings to experience, then act only on rules everyone could share." },
  { slug: "kurt-godel", name: "Kurt Gödel", wing: "questioners", method: "Formalize the rules, encode the system inside itself, and find what it cannot decide." },
  { slug: "marilyn-vos-savant", name: "Marilyn vos Savant", wing: "questioners", method: "Spell out every equally likely case, exaggerate the setup, and let the tally beat intuition.", living: true },
  { slug: "michel-foucault", name: "Michel Foucault", wing: "questioners", method: "Trace how a norm became normal, map who watches and ranks, and name who is excluded." },
  { slug: "descartes", name: "René Descartes", wing: "questioners", method: "Doubt what can be doubted, divide the problem, rebuild simple to complex, and enumerate everything." },
  { slug: "richard-feynman", name: "Richard Feynman", wing: "questioners", method: "Rebuild any idea from scratch until a newcomer follows it, then hunt the self-deception." },
  { slug: "simone-de-beauvoir", name: "Simone de Beauvoir", wing: "questioners", method: "Find who is cast as Other, map their situation, and pursue freedom that frees others too." },
  { slug: "socrates", name: "Socrates", wing: "questioners", method: "Demand a definition, test it against cases and other beliefs, and own the ignorance it exposes." },
  { slug: "voltaire", name: "Voltaire", wing: "questioners", method: "Walk a grand theory through real disasters until its absurdity shows, then fight one concrete injustice." },
  { slug: "mohammad-abdus-salam", name: "Abdus Salam", wing: "lawfinders", method: "Find the one structure behind separate forces, explain why it hides, and reconnect isolated talent." },
  { slug: "albert-einstein", name: "Albert Einstein", wing: "lawfinders", method: "Imagine the idealized scene, keep trusted principles, and drop the hidden assumption that makes them clash." },
  { slug: "archimedes", name: "Archimedes", wing: "lawfinders", method: "Guess the answer with a physical model, then prove it by trapping it between tightening bounds." },
  { slug: "aristotle", name: "Aristotle", wing: "lawfinders", method: "Gather cases and opinions, sort by kind, explain by four causes, and aim for the mean." },
  { slug: "yang-chen-ning", name: "Chen-Ning Yang", wing: "lawfinders", method: "Start from the symmetry, derive the structure it forces, and test the assumptions nobody tested.", living: true },
  { slug: "edward-witten", name: "Edward Witten", wing: "lawfinders", method: "Find a deformation-proof quantity or dual description, compute where it's easy, and carry the answer back.", living: true },
  { slug: "emmy-noether", name: "Emmy Noether", wing: "lawfinders", method: "Find what you can change without changing the outcome, and track the quantity that symmetry conserves." },
  { slug: "erwin-schrodinger", name: "Erwin Schrödinger", wing: "lawfinders", method: "Make ad hoc rules fall out of one structure; then scale theories up until absurdities show." },
  { slug: "sir-isaac-newton", name: "Isaac Newton", wing: "lawfinders", method: "Measure the phenomena, find one mathematical law covering them all, and refuse untestable stories about causes." },
  { slug: "james-clerk-maxwell", name: "James Clerk Maxwell", wing: "lawfinders", method: "Borrow a vivid analogy to build the model, keep the equations, then kick away the scaffold." },
  { slug: "niels-bohr", name: "Niels Bohr", wing: "lawfinders", method: "Keep mutually exclusive descriptions side by side, specify the setup for each, and argue until clear." },
  { slug: "paul-dirac", name: "Paul Dirac", wing: "lawfinders", method: "Demand an elegant, consistent formulation, then take its strangest consequences seriously as predictions." },
  { slug: "peter-higgs", name: "Peter Higgs", wing: "lawfinders", method: "Expose the hidden assumptions behind an impossibility proof, then state the testable prediction the loophole implies." },
  { slug: "satyendra-nath-bose", name: "Satyendra Nath Bose", wing: "lawfinders", method: "Fix the counting: decide what is truly distinguishable, then derive everything from one consistent footing." },
  { slug: "subrahmanyan-chandrasekhar", name: "Subrahmanyan Chandrasekhar", wing: "lawfinders", method: "Master one domain, write its complete ordered account from first principles, then deliberately start another." },
  { slug: "werner-heisenberg", name: "Werner Heisenberg", wing: "lawfinders", method: "Discard quantities no one can observe, rebuild from observables, and accept the trade-offs that follow." },
  { slug: "alexander-grothendieck", name: "Alexander Grothendieck", wing: "pattern_seers", method: "Build the general theory patiently until the hard problem softens and opens without force." },
  { slug: "aryabhata", name: "Aryabhata", wing: "pattern_seers", method: "Pack a whole system into a few memorable lines, and replace myth with computable mechanism." },
  { slug: "riemann", name: "Bernhard Riemann", wing: "pattern_seers", method: "Build the space the problem truly lives in, then read its shape and singular points." },
  { slug: "carl-gauss", name: "Carl Friedrich Gauss", wing: "pattern_seers", method: "Let all the noisy data vote, prove key claims several ways, and release only finished work." },
  { slug: "christopher-michael-langan", name: "Christopher Langan", wing: "pattern_seers", method: "Demand that any model include its observer, generate its own rules, and close its self-reference loops.", contested: true, living: true },
  { slug: "claude-levi-strauss", name: "Claude Lévi-Strauss", wing: "pattern_seers", method: "Find meaning in relations and oppositions, compare variants as transformations, and build from what's at hand." },
  { slug: "daniel-afedzi-akyeampong", name: "Daniel Afedzi Akyeampong", wing: "pattern_seers", method: "When a calculation blows up, embed it in a tunable family, then track which symmetries break.", living: true },
  { slug: "douglas-hofstadter", name: "Douglas Hofstadter", wing: "pattern_seers", method: "Trace how systems loop back on themselves, and treat analogy-making as the engine of thought." },
  { slug: "francis-kofi-ampenyin-allotey", name: "Francis Allotey", wing: "pattern_seers", method: "Find the interaction the simple theory ignores, then build institutions so local talent can solve problems." },
  { slug: "grigori-perelman", name: "Grigori Perelman", wing: "pattern_seers", method: "Let the system smooth itself, track a quantity that only improves, and operate where it pinches.", living: true },
  { slug: "hypatia", name: "Hypatia of Alexandria", wing: "pattern_seers", method: "Check the canonical text line by line, annotate it for learners, and teach it openly." },
  { slug: "john-h-conway", name: "John Horton Conway", wing: "pattern_seers", method: "Recast the problem as a game with minimal rules, then play until deep structure emerges." },
  { slug: "leonhard-euler", name: "Leonhard Euler", wing: "pattern_seers", method: "Work many cases, reduce the problem to its bare skeleton, name the pattern, and generalize it." },
  { slug: "m-c-escher", name: "M. C. Escher", wing: "pattern_seers", method: "Find the rule that tiles a space seamlessly, then bend it into loops and paradox." },
  { slug: "maryam-mirzakhani", name: "Maryam Mirzakhani", wing: "pattern_seers", method: "Map the whole space of possible versions, cut it into simple pieces, and count patiently." },
  { slug: "shing-tung-yau", name: "Shing-Tung Yau", wing: "pattern_seers", method: "Try to disprove the conjecture, then bound every possible solution and deform from a known case.", living: true },
  { slug: "srinivasa-ramanujan", name: "Srinivasa Ramanujan", wing: "pattern_seers", method: "Compute special cases until an exact formula surfaces, test it hard, then find a prover." },
  { slug: "terence-chi-shen-tao", name: "Terence Tao", wing: "pattern_seers", method: "Split the problem into structured and random parts, solve toy versions, and verify every piece.", living: true },
  { slug: "william-james-sidis", name: "William James Sidis", wing: "pattern_seers", method: "Push a pattern up a dimension, run one-way laws backward, and read overlooked records systematically." },
  { slug: "lovelace", name: "Ada Lovelace", wing: "formalizers", method: "Generalize the machine past its first job, trace every operation, and name what it cannot do." },
  { slug: "al-kindi", name: "Al-Kindi", wing: "formalizers", method: "Crack hidden structure by counting what recurs against a baseline, and take truth from any source." },
  { slug: "alan-turing", name: "Alan Turing", wing: "formalizers", method: "Model the process as a simple machine, test it operationally, and find its provable limits." },
  { slug: "blaise-pascal", name: "Blaise Pascal", wing: "formalizers", method: "Enumerate the possible outcomes, weigh each by odds and stakes, and test with a decisive experiment." },
  { slug: "claude-shannon", name: "Claude Shannon", wing: "formalizers", method: "Strip meaning away, count the uncertainty in bits, and find the best any design could do." },
  { slug: "david-hilbert", name: "David Hilbert", wing: "formalizers", method: "State every assumption as an axiom, test their independence, and set the agenda with sharp problems." },
  { slug: "donald-knuth", name: "Donald Knuth", wing: "formalizers", method: "Analyze algorithms exactly, optimize only measured hot spots, and write code as essays for people.", living: true },
  { slug: "gottfried-wilhelm-leibniz", name: "Gottfried Wilhelm Leibniz", wing: "formalizers", method: "Design notation that does the reasoning, then settle disagreements by calculating instead of arguing." },
  { slug: "john-mccarthy", name: "John McCarthy", wing: "formalizers", method: "State knowledge as facts programs can reason over, and make code data that programs transform." },
  { slug: "john-von-neumann", name: "John von Neumann", wing: "formalizers", method: "Strip a system to its logical design, assume a smart adversary, and simulate what resists analysis." },
  { slug: "al-khawarizmi", name: "Muhammad ibn Musa al-Khwarizmi", wing: "formalizers", method: "Sort each problem into a standard type, restore and balance it, then run a proven recipe." },
  { slug: "norbert-wiener", name: "Norbert Wiener", wing: "formalizers", method: "Map every feedback loop, predict from noisy signals, and confirm the machine's purpose is yours." },
  { slug: "avicenna-ibn-sina", name: "Avicenna (Ibn Sina)", wing: "experimenters", method: "Organize knowledge from principles to particulars, and test each claim under strict conditions." },
  { slug: "barbara-mcclintock", name: "Barbara McClintock", wing: "experimenters", method: "Know each organism intimately, read odd patterns as records of hidden events, and persist." },
  { slug: "bennet-ifeakandu-omalu", name: "Bennet Omalu", wing: "experimenters", method: "When the surface looks normal but the history does not, look deeper and follow the evidence.", living: true },
  { slug: "c-v-raman", name: "C. V. Raman", wing: "experimenters", method: "Question everyday sights, strip confounders with simple tools, and filter until only the new remains." },
  { slug: "chien-shiung-wu", name: "Chien-Shiung Wu", wing: "experimenters", method: "Test the assumption everyone trusts, with airtight precision and controls that reverse the effect." },
  { slug: "christopher-michael-hirata", name: "Christopher Hirata", wing: "experimenters", method: "Chase the subtle biases standard checks miss, including cross-terms and neglected effects, until errors are budgeted.", living: true },
  { slug: "galileo-galilei", name: "Galileo Galilei", wing: "experimenters", method: "Turn arguments into measurements: slow the phenomenon, time it, strip away friction, point new instruments." },
  { slug: "gladys-brown-west", name: "Gladys West", wing: "experimenters", method: "Model messy reality's true shape, correcting for every force that bends the data.", living: true },
  { slug: "ibn-battuta", name: "Ibn Battuta", wing: "experimenters", method: "Move through networks, compare local customs to your assumptions, and turn the journey into a report." },
  { slug: "jagadish-chandra-bose", name: "Jagadish Chandra Bose", wing: "experimenters", method: "Rescale phenomena to fit your bench, build your own instruments, and compare unlike things." },
  { slug: "jane-goodall", name: "Jane Goodall", wing: "experimenters", method: "Watch patiently for years, know each individual, and let what you see overturn fond beliefs.", living: true },
  { slug: "jocelyn-bell-burnell", name: "Jocelyn Bell Burnell", wing: "experimenters", method: "Know the usual signals and noise so well that anything else stands out, then test it.", living: true },
  { slug: "creola-katherine-johnson", name: "Katherine Johnson", wing: "experimenters", method: "Derive from geometry, verify machines independently, and ask to join the room where decisions happen." },
  { slug: "lise-meitner", name: "Lise Meitner", wing: "experimenters", method: "Treat the impossible result as real, model how it could happen, and make the numbers balance." },
  { slug: "marie-curie", name: "Marie Curie", wing: "experimenters", method: "Turn a strange effect into precise numbers, then hunt whatever the numbers cannot yet explain." },
  { slug: "rosalind-franklin", name: "Rosalind Franklin", wing: "experimenters", method: "Control the conditions, measure precisely, and let the data constrain the model before guessing." },
  { slug: "segenet-kelemu", name: "Segenet Kelemu", wing: "experimenters", method: "Find the unseen partners behind resilience, prove their effect cleanly, then build institutions to scale it.", living: true },
  { slug: "captain-sir-richard-francis-burton", name: "Sir Richard Francis Burton", wing: "experimenters", method: "Enter a culture through its language and daily life, observe everything, and write it down exhaustively." },
  { slug: "tu-youyou", name: "Tu Youyou", wing: "experimenters", method: "Screen old knowledge systematically, reread it for lost process clues, then test with care." },
  { slug: "venkatraman-ramakrishnan", name: "Venkatraman Ramakrishnan", wing: "experimenters", method: "Switch fields to reach the central problem, then see the machine working in atomic detail.", living: true },
  { slug: "arthur-c-clarke", name: "Arthur C. Clarke", wing: "imaginers", method: "Extrapolate real physics into concrete futures, and test whether impossible just means unimagined." },
  { slug: "sagan", name: "Carl Sagan", wing: "imaginers", method: "Zoom out to the cosmic scale for perspective, then run every claim through a baloney detector." },
  { slug: "demis-hassabis", name: "Demis Hassabis", wing: "imaginers", method: "Choose problems whose solution unlocks whole fields, then attack them with search guided by learned models.", living: true },
  { slug: "frank-herbert", name: "Frank Herbert", wing: "imaginers", method: "Model ecology, economy, belief, and power as one system, and distrust charismatic saviors." },
  { slug: "freeman-dyson", name: "Freeman Dyson", wing: "imaginers", method: "Translate rival methods into one language, imagine centuries ahead, and prefer quick, small bets." },
  { slug: "ilya-sutskever", name: "Ilya Sutskever", wing: "imaginers", method: "Trust simple learning at scale, recast tasks as prediction, and study where models generalize poorly.", living: true },
  { slug: "isaac-asimov", name: "Isaac Asimov", wing: "imaginers", method: "Write a system's rules down plainly, then find the stories where they fail." },
  { slug: "jorge-luis-borges", name: "Jorge Luis Borges", wing: "imaginers", method: "Compress vast ideas into short fictions and push each to its logical limit." },
  { slug: "kip-thorne", name: "Kip Thorne", wing: "imaginers", method: "Label every idea as truth, educated guess, or speculation, then pursue bold goals inside physical law.", living: true },
  { slug: "leonardo-di-ser-piero-da-vinci", name: "Leonardo da Vinci", wing: "imaginers", method: "See by drawing, borrow patterns across domains, and keep a notebook of relentless questions." },
  { slug: "copernicus", name: "Nicolaus Copernicus", wing: "imaginers", method: "Ask whether the motion you see is your own, then rebuild the whole around that." },
  { slug: "tesla", name: "Nikola Tesla", wing: "imaginers", method: "Prototype the whole machine in imagination, and remove the part everyone assumes is necessary." },
  { slug: "roger-penrose", name: "Roger Penrose", wing: "imaginers", method: "Draw the whole geometry, find arguments that survive messiness, and check local fits for global impossibility.", living: true },
  { slug: "stephen-william-hawking", name: "Stephen Hawking", wing: "imaginers", method: "Push two trusted theories to their collision point, compute anyway, and take the resulting paradox seriously." },
  { slug: "benjamin-banneker", name: "Benjamin Banneker", wing: "builders", method: "Learn from borrowed tools, compute everything yourself, and let the finished work argue for you." },
  { slug: "benjamin-franklin", name: "Benjamin Franklin", wing: "builders", method: "Run a practical test, weigh decisions in writing, and turn good ideas into lasting institutions." },
  { slug: "bjarne-stroustrup", name: "Bjarne Stroustrup", wing: "builders", method: "Add abstractions that cost nothing unused, tie resources to lifetimes, and evolve without stranding users.", living: true },
  { slug: "buckminster-fuller", name: "Buckminster Fuller", wing: "builders", method: "Start from the whole system, find the trim tab, and do ever more with less." },
  { slug: "george-washington-carver", name: "George Washington Carver", wing: "builders", method: "Design for the poorest user's resources, restore the base, and carry the lesson to them." },
  { slug: "grace-hopper", name: "Grace Hopper", wing: "builders", method: "Let machines translate, write in the user's words, and challenge practices kept only by habit." },
  { slug: "hedy-lamarr", name: "Hedy Lamarr", wing: "builders", method: "Name the attack precisely, then import a working mechanism from an unrelated field to defeat it." },
  { slug: "homi-j-bhabha", name: "Homi J. Bhabha", wing: "builders", method: "Grow outstanding people first, stage the plan around real resources, and build capability at home." },
  { slug: "imhotep", name: "Imhotep", wing: "builders", method: "Scale a proven form stage by stage, rebuilding familiar designs in durable new material." },
  { slug: "john-bardeen", name: "John Bardeen", wing: "builders", method: "Explain why attempts fail, strip problems to essentials, and persist with teammates who supply missing skills." },
  { slug: "john-carmack", name: "John Carmack", wing: "builders", method: "Find the constraint that matters, study the research, build it yourself, measure, and publish the notes.", living: true },
  { slug: "linus-torvalds", name: "Linus Torvalds", wing: "builders", method: "Judge by working code, fix the data structures, never break users, and scale trust through maintainers.", living: true },
  { slug: "margaret-hamilton", name: "Margaret Hamilton", wing: "builders", method: "Assume the impossible failure will occur, rank every task, and build recovery in before launch.", living: true },
  { slug: "nashwa-abo-alhassan-eassa", name: "Nashwa Abo Alhassan Eassa", wing: "builders", method: "Treat the thin layer that spoils performance, then aim affordable materials at local needs.", living: true },
  { slug: "percy-lavon-julian", name: "Percy Julian", wing: "builders", method: "Find an abundant cheap feedstock, turn it into the scarce molecule, and scale the process." },
  { slug: "philip-emeagwali", name: "Philip Emeagwali", wing: "builders", method: "Return to the full equations and recast them so many simple processors solve them cheaply.", living: true },
  { slug: "thomas-edison", name: "Thomas Edison", wing: "builders", method: "Run invention as organized team search, and design the whole system its economics demand." },
  { slug: "tim-berners-lee", name: "Tim Berners-Lee", wing: "builders", method: "Give everything a universal name, let anyone link without permission, and keep the standards open.", living: true },
  { slug: "bobby-fischer", name: "Bobby Fischer", wing: "strategists", method: "Study deeper than rivals, seek the objectively best move, and play every game to win." },
  { slug: "garry-kimovich-kasparov", name: "Garry Kasparov", wing: "strategists", method: "Prepare deeper than anyone, then trade material for time so the opponent is always reacting.", living: true },
  { slug: "john-nash", name: "John Nash", wing: "strategists", method: "Map every player's options and payoffs, then find where no one gains by switching alone." },
  { slug: "jose-raul-capablanca", name: "José Raúl Capablanca", wing: "strategists", method: "Master the endings first, simplify toward them, and follow one plan your resources can execute." },
  { slug: "judit-polgar", name: "Judit Polgár", wing: "strategists", method: "Skip the separate league, measure yourself against the strongest field, and attack fearlessly with drilled tactics.", living: true },
  { slug: "magnus-carlsen", name: "Magnus Carlsen", wing: "strategists", method: "Take a playable equal position, keep the game going, and press until the opponent cracks.", living: true },
  { slug: "bonaparte", name: "Napoleon Bonaparte", wing: "strategists", method: "Find the decisive point, move faster than rivals can react, and arrive there with superior force." },
  { slug: "paul-morphy", name: "Paul Morphy", wing: "strategists", method: "Get every piece working before attacking, then open lines toward the target while the opponent lags." },
  { slug: "sun-tzu", name: "Sun Tzu", wing: "strategists", method: "Shape conditions and know both sides so well that the contest is decided before it starts." },
  { slug: "yi-sun-sin", name: "Yi Sun-sin", wing: "strategists", method: "Prepare before the crisis, fight where terrain and tide multiply your few ships, and log everything." },
  { slug: "abraham-maslow", name: "Abraham Maslow", wing: "mind_mappers", method: "Identify which needs are unmet, separate lack from growth, study thriving exemplars, and check your hammer." },
  { slug: "b-f-skinner", name: "B. F. Skinner", wing: "mind_mappers", method: "Define behavior observably, find what reinforces it, and shape it in small, immediately rewarded steps." },
  { slug: "benjamin-bloom", name: "Benjamin Bloom", wing: "mind_mappers", method: "Place every objective in the taxonomy table, align tests to it, and loop feedback until mastery." },
  { slug: "carl-jung", name: "Carl Jung", wing: "mind_mappers", method: "Surface what the persona hides and the psyche disowns, then integrate the neglected opposite." },
  { slug: "carl-rogers", name: "Carl Rogers", wing: "mind_mappers", method: "Listen until you can restate someone's meaning and feeling, accept the person, and stay genuine." },
  { slug: "edward-bernays", name: "Edward Bernays", wing: "mind_mappers", method: "Research the public, persuade through groups and symbols openly, and expose campaigns that hide their sponsors." },
  { slug: "evangelos-katsioulis", name: "Evangelos Katsioulis", wing: "mind_mappers", method: "Profile abilities by field and level, then build forums where original ideas meet real critique.", living: true },
  { slug: "geoffrey-hinton", name: "Geoffrey Hinton", wing: "mind_mappers", method: "Trust learning over hand-built rules, follow the error gradient, and inspect what the network learned.", living: true },
  { slug: "jean-piaget", name: "Jean Piaget", wing: "mind_mappers", method: "Treat wrong answers as windows on a mental scheme, then build the conflict that restructures it." },
  { slug: "john-hopfield", name: "John Hopfield", wing: "mind_mappers", method: "Hunt paradoxes between theory and data, then model the system as dynamics rolling downhill into answers.", living: true },
  { slug: "julian-jaynes", name: "Julian Jaynes", wing: "mind_mappers", method: "Treat consciousness as a learned, language-built mind-space, and ask whose voice issues the commands.", contested: true },
  { slug: "les-fehmi", name: "Les Fehmi", wing: "mind_mappers", method: "Notice your attention style, then soften narrow grip into open, spacious, flexible focus." },
  { slug: "marshall-mcluhan", name: "Marshall McLuhan", wing: "mind_mappers", method: "Probe what a medium does regardless of content, and run the tetrad on every new tool." },
  { slug: "marvin-minsky", name: "Marvin Minsky", wing: "mind_mappers", method: "Explain intelligence as many simple agents, unpack suitcase words, and keep several ways to think." },
  { slug: "noam-chomsky", name: "Noam Chomsky", wing: "mind_mappers", method: "Seek rules generating all and only valid cases, then ask which filters shaped the news.", living: true },
  { slug: "sigmund-freud", name: "Sigmund Freud", wing: "mind_mappers", method: "Let talk run free, read slips, repetitions, and defenses as clues, and test every interpretation.", contested: true },
  { slug: "terrence-deacon", name: "Terrence Deacon", wing: "mind_mappers", method: "Explain purpose and meaning through constraints, what is absent, and self-maintaining coupled processes.", living: true },
  { slug: "william-james", name: "William James", wing: "mind_mappers", method: "Judge ideas by their practical difference, choose what to attend to, and build habits deliberately." },
  { slug: "yann-lecun", name: "Yann LeCun", wing: "mind_mappers", method: "Build the data's structure into the architecture, learn mostly from observation, and predict abstract states.", living: true },
  { slug: "alan-watts", name: "Alan Watts", wing: "awakeners", method: "Stop grasping for security, see opposites as partners, and play life like music, not a race." },
  { slug: "baruch-spinoza", name: "Baruch Spinoza", wing: "awakeners", method: "Map emotions to causes, see events as necessary parts of nature, and argue in geometric order." },
  { slug: "douglas-harding", name: "Douglas Harding", wing: "awakeners", method: "Turn attention around and test, not believe, that at center you are open capacity for everything." },
  { slug: "eckhart-tolle", name: "Eckhart Tolle", wing: "awakeners", method: "Step back from compulsive thinking into present awareness, accept this moment, then act from there.", living: true },
  { slug: "hildegard-of-bingen", name: "Hildegard of Bingen", wing: "awakeners", method: "Render one vision across forms, link cosmos to detail, and tend the living green in everything." },
  { slug: "krishnamurti", name: "Jiddu Krishnamurti", wing: "awakeners", method: "Watch what is, without condemning or justifying, until watcher and watched are seen as one movement." },
  { slug: "kim-ung-yong", name: "Kim Ung-yong", wing: "awakeners", method: "Refuse borrowed scoreboards; choose ordinary, sustainable work that makes you content, and let labels fall.", living: true },
  { slug: "marcus-aurelius", name: "Marcus Aurelius", wing: "awakeners", method: "Write private reminders, strip events to facts, view them from above, and serve the common good." },
  { slug: "omar-khayyam", name: "Omar Khayyam", wing: "awakeners", method: "List every case, switch methods when one stalls, measure carefully, and live well without final answers." },
  { slug: "paramahansa-yogananda", name: "Paramahansa Yogananda", wing: "awakeners", method: "Treat inner life as an experiment: meditate daily, judge methods by results, balance stillness with work." },
  { slug: "ram-dass", name: "Ram Dass", wing: "awakeners", method: "Witness your drama with loving awareness, see people as souls, and turn practice into service." },
  { slug: "ramanuja", name: "Ramanuja", wing: "awakeners", method: "Keep the many real within one whole, read every source together, pair knowledge with devotion." },
  { slug: "richard-lang", name: "Richard Lang", wing: "awakeners", method: "Make the experiments quick, playful tests anyone can share, then carry seeing into ordinary life.", living: true },
  { slug: "rumi", name: "Rumi", wing: "awakeners", method: "Teach through nested stories, read longing as a compass home, and let love outrank cleverness." },
  { slug: "seneca", name: "Seneca", wing: "awakeners", method: "Treat time as your only true possession, rehearse misfortune early, and practice hardship before it arrives." },
  { slug: "siddhartha-gautama", name: "Siddhartha Gautama (the Buddha)", wing: "awakeners", method: "Name the suffering, trace the craving behind it, see that it can end, walk the path." },
  { slug: "thich-nhat-hanh", name: "Thích Nhất Hạnh", wing: "awakeners", method: "Return to the breath, do one thing fully, and see how everything inter-is with everything else." },
  { slug: "viktor-frankl", name: "Viktor Frankl", wing: "awakeners", method: "Find meaning through work, love, and chosen attitude, and answer what the situation asks of you." },
  { slug: "ahmad-baba-al-timbukti", name: "Ahmad Baba al-Timbukti", wing: "society_shapers", method: "Test whether a rule's criterion is the real ground or a prejudiced proxy, then rule precisely." },
  { slug: "al-farabi", name: "Al-Farabi", wing: "society_shapers", method: "Order the knowledge, aim the community at true happiness, and fit one truth to each audience." },
  { slug: "amartya-kumar-sen", name: "Amartya Sen", wing: "society_shapers", method: "Judge outcomes by people's real capabilities and entitlements, and compare feasible options through open public reasoning.", living: true },
  { slug: "andrew-yang", name: "Andrew Yang", wing: "society_shapers", method: "Trace how automation reshapes work, put numbers on the human impact, then test cross-partisan systemic fixes.", living: true },
  { slug: "cheikh-anta-diop", name: "Cheikh Anta Diop", wing: "society_shapers", method: "Question the inherited story, then test it with converging evidence from several disciplines." },
  { slug: "confucius", name: "Confucius", wing: "society_shapers", method: "Cultivate yourself first, make names match realities, and lead by example and ritual rather than force." },
  { slug: "hannah-arendt", name: "Hannah Arendt", wing: "society_shapers", method: "Stop and think for yourself, judge the new case freshly, and weigh it from others' standpoints." },
  { slug: "ibn-khaldun", name: "Ibn Khaldun", wing: "society_shapers", method: "Track cohesion as it rises and decays, and test every report against how societies work." },
  { slug: "jean-jacques-rousseau", name: "Jean-Jacques Rousseau", wing: "society_shapers", method: "Separate real needs from status-seeking, find the common good beneath private wants, and let learners discover." },
  { slug: "john-locke", name: "John Locke", wing: "society_shapers", method: "Trace every idea back to experience, define your words, and ground authority in consent and trust." },
  { slug: "jean-maynard-keynes", name: "John Maynard Keynes", wing: "society_shapers", method: "Follow total spending, split risk from true uncertainty, and lean against the herd when confidence breaks." },
  { slug: "john-stuart-mill", name: "John Stuart Mill", wing: "society_shapers", method: "Find causes by comparing cases, hear the strongest dissent, and restrict freedom only to prevent harm." },
  { slug: "maimonides", name: "Maimonides", wing: "society_shapers", method: "Turn tangled rules into a clear code, reconcile reason with tradition, give help that builds independence." },
  { slug: "plato", name: "Plato", wing: "society_shapers", method: "Tell shadows from reality, define the ideal, and build institutions that educate people toward it." },
  { slug: "thomas-hobbes", name: "Thomas Hobbes", wing: "society_shapers", method: "Define terms, reason like arithmetic, and ask what order survives when nobody enforces the rules." },
  { slug: "thomas-jefferson", name: "Thomas Jefferson", wing: "society_shapers", method: "Write principles plainly, keep meticulous records, test designs for years, and audit creed against conduct." },
  { slug: "tshilidzi-marwala", name: "Tshilidzi Marwala", wing: "society_shapers", method: "Use AI to fill missing information and steady inconsistent judgment, then govern the tradeoffs it creates.", living: true },
  { slug: "fyodor-dostoevsky", name: "Fyodor Dostoevsky", wing: "artists", method: "Embody each idea in a character who argues it fully, then let them collide under pressure." },
  { slug: "johann-sebastian-bach", name: "Johann Sebastian Bach", wing: "artists", method: "Weave independent lines into one structure, working every case systematically and delivering on deadline." },
  { slug: "johann-wolfgang-von-goethe", name: "Johann Wolfgang von Goethe", wing: "artists", method: "Look patiently at a living thing until its transformations reveal the form beneath." },
  { slug: "leo-tolstoy", name: "Leo Tolstoy", wing: "artists", method: "Render ordinary life in exact detail so readers feel it, then ask how to live." },
  { slug: "ludwig-van-beethoven", name: "Ludwig van Beethoven", wing: "artists", method: "Grow a whole work from a tiny cell through relentless sketching and revision." },
  { slug: "michelangelo-buonarroti", name: "Michelangelo Buonarroti", wing: "artists", method: "See the figure already inside the raw block, know its anatomy, and cut away the rest." },
  { slug: "steve-jobs", name: "Steve Jobs", wing: "artists", method: "Cut to the few products worth perfecting, design from the experience backward, and control the whole." },
  { slug: "vincent-van-gogh", name: "Vincent van Gogh", wing: "artists", method: "Work daily, learn by copying masters, think in letters, and let color carry feeling." },
  { slug: "shakespeare", name: "William Shakespeare", wing: "artists", method: "Let every character think aloud, mix high and low, and make words carry the action." },
  { slug: "mozart", name: "Wolfgang Amadeus Mozart", wing: "artists", method: "Absorb every style around you, then write clear, balanced forms where each voice has character." },
];

const BY_SLUG = new Map(GENIUSES.map((g) => [g.slug, g]));

export function getGenius(slug: string): Genius {
  const g = BY_SLUG.get(slug);
  if (!g) throw new Error(`Unknown genius: ${slug}`);
  return g;
}

export function geniusesInWing(wing: WingId): Genius[] {
  return GENIUSES.filter((g) => g.wing === wing);
}

export const GENIUS_ID_PREFIX = 'genius:';

export function isGeniusArchetype(archetype: FighterArchetype): boolean {
  return archetype.id.startsWith(GENIUS_ID_PREFIX);
}

/** Give a genius a body: their wing's fighting style, their own method. */
export function geniusArchetype(slug: string): FighterArchetype {
  const g = getGenius(slug);
  const w = WINGS[g.wing];
  return {
    id: `${GENIUS_ID_PREFIX}${g.slug}`,
    name: g.name,
    title: `${w.name.replace(/^The /, '')} — ${w.move}`,
    description: g.method + (g.contested ? ' (Contested lens.)' : ''),
    traits: { ...w.traits },
    fallacyRisk: { ...w.fallacyRisk },
    palette: { ...w.palette },
  };
}
