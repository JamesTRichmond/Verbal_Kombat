/**
 * vk lab CLI.
 *
 *   npm run lab -- decide <problem.json> [--mode quick|council|full] [--offline] [--out report.md] [--checkpoint file] [--journal journal.json]
 *   npm run lab -- arena  <arena.json>  [--offline]
 *   npm run lab -- brier  <journal.json>
 *   npm run lab -- roster init [--dir data/fighters]
 *   npm run lab -- roster [--dir data/fighters] [--top N]
 *   npm run lab -- fighter <slug> [--dir data/fighters]
 *   npm run lab -- train [--bouts N] [--seed S] [--pairing random|weakest-vs-strongest|wing-rivals] [--offline] [--dir data/fighters] [--now ISO] [--topics topics.json] [--turns N]
 *
 * decide and arena take --roster <dir> to persist fighter growth there.
 *
 * Online configuration (OpenAI-compatible endpoint) comes from env:
 *   VK_API_KEY   (or OPENAI_API_KEY)   required online
 *   VK_BASE_URL  (or OPENAI_BASE_URL)  default https://api.openai.com/v1
 *   VK_MODEL     (or OPENAI_MODEL)     default gpt-4o-mini
 *   VK_JUDGE_MODELS  comma-separated; >1 model → EnsembleJudge
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getGenius,
  renderFighterLog,
  type CouncilMode,
  type Genius,
  type MatchReplay,
  type Proposal,
  type ValueProfile,
  type WingId,
} from '@vk/core';
import { LlmAgent, LlmProposer, OpenAiChatClient, type ChatClient } from '@vk/debate';
import { EnsembleJudge, HeuristicJudge, LlmJudge, type Judge } from '@vk/judge';
import { benchmarkAgents, renderScorecards, type ArenaEntrant, type ArenaTopic } from './arena.js';
import { decisionRecord, renderDecisionMarkdown, runDecision } from './decision.js';
import { DecisionJournal } from './journal.js';
import { MockChatClient, type MockChatClientOptions } from './mock-client.js';
import { DEFAULT_ROSTER_DIR, FileFighterStore, renderStandingsTable } from './roster-store.js';
import { PAIRINGS, renderTrainingSummary, trainingCamp, type Pairing } from './training.js';

export interface CliIo {
  log: (line: string) => void;
  error: (line: string) => void;
  env: Record<string, string | undefined>;
  now: () => Date;
}

export interface ProblemFile {
  id?: string;
  problem: string;
  profile: ValueProfile;
  mode?: CouncilMode;
  seats?: string[];
  prefer?: string[];
  homeWing?: WingId;
  statusQuo?: Omit<Proposal, 'seat'>;
  /** Utterances per seat per bout. Default 3. */
  maxTurns?: number;
}

export interface ArenaFile {
  id?: string;
  rounds?: number;
  maxTurns?: number;
  topics: ArenaTopic[];
  entrants: {
    id: string;
    archetypeId?: string;
    /** Offline personality. */
    mock?: MockChatClientOptions;
    /** Online overrides. */
    model?: string;
    baseUrl?: string;
    /** Name of the env var holding this entrant's key. */
    apiKeyEnv?: string;
  }[];
}

const USAGE = [
  'usage:',
  '  npm run lab -- decide <problem.json> [--mode quick|council|full] [--offline] [--out report.md] [--checkpoint file] [--journal journal.json] [--roster <dir>]',
  '  npm run lab -- arena <arena.json> [--offline] [--roster <dir>]',
  '  npm run lab -- brier <journal.json>',
  '  npm run lab -- roster init [--dir data/fighters]',
  '  npm run lab -- roster [--dir data/fighters] [--top N]',
  '  npm run lab -- fighter <slug> [--dir data/fighters]',
  `  npm run lab -- train [--bouts N] [--seed S] [--pairing ${PAIRINGS.join('|')}] [--offline] [--dir data/fighters] [--now ISO] [--topics topics.json] [--turns N]`,
].join('\n');

export async function main(argv: string[], io: Partial<CliIo> = {}): Promise<number> {
  const out: CliIo = {
    log: io.log ?? ((l) => console.log(l)),
    error: io.error ?? ((l) => console.error(l)),
    env: io.env ?? process.env,
    now: io.now ?? (() => new Date()),
  };
  const { positional, flags } = parseArgs(argv);
  const [command, file] = positional;
  try {
    if (command === 'decide' && file) return await decide(file, flags, out);
    if (command === 'arena' && file) return await arena(file, flags, out);
    if (command === 'brier' && file) return brier(file, out);
    if (command === 'roster' && file === 'init') return rosterInit(flags, out);
    if (command === 'roster' && file === undefined) return roster(flags, out);
    if (command === 'fighter' && file) return fighter(file, flags, out);
    if (command === 'train' && file === undefined) return await train(flags, out);
    out.error(USAGE);
    return 2;
  } catch (err) {
    out.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

async function decide(file: string, flags: Flags, io: CliIo): Promise<number> {
  const spec = readJson<ProblemFile>(file);
  if (!spec.problem || !spec.profile) throw new Error(`${file}: needs "problem" and "profile"`);
  const mode = parseMode(flagString(flags, 'mode') ?? spec.mode ?? 'quick');
  const offline = flags.offline === true;
  const maxTurns = spec.maxTurns ?? 3;
  const journalPath = flagString(flags, 'journal');
  const journal = journalPath ? DecisionJournal.load(journalPath) : undefined;
  const now = io.now();

  let proposerClient: ChatClient;
  let debaterClient: (seat: Genius, boutId: string) => ChatClient;
  let judge: Judge;
  if (offline) {
    proposerClient = new MockChatClient({ seed: 7 });
    debaterClient = (seat, boutId) => {
      const h = hash(`${seat.slug}|${boutId}`);
      // A spread of discipline so the fights actually separate the seats.
      return new MockChatClient({ seed: h, personality: 'good', fallacyRate: (hash(seat.slug) % 4) * 0.15 });
    };
    judge = new HeuristicJudge();
  } else {
    const client = onlineClient(io.env);
    proposerClient = client;
    debaterClient = () => client;
    judge = onlineJudge(io.env);
  }

  const seats = spec.seats?.map(getGenius);
  const store = rosterStore(flags);
  // Checkpoint after every proposal and bout so a crash never loses a live council.
  // Only when a report path (or an explicit --checkpoint) is given, so examples stay clean.
  const outFlag = flagString(flags, 'out');
  const checkpointPath = flagString(flags, 'checkpoint') ?? (outFlag ? `${outFlag}.checkpoint.json` : undefined);
  const checkpoint: { proposals: Proposal[]; bouts: { id: string; replay: MatchReplay }[] } =
    checkpointPath && existsSync(checkpointPath) ? readJson(checkpointPath) : { proposals: [], bouts: [] };
  if (checkpointPath && (checkpoint.proposals.length || checkpoint.bouts.length)) {
    io.log(`resuming from ${checkpointPath}: ${checkpoint.proposals.length} proposal(s), ${checkpoint.bouts.length} bout(s) already done`);
  }
  const saveCheckpoint = () => {
    if (checkpointPath) writeFileSync(checkpointPath, JSON.stringify(checkpoint) + '\n', 'utf8');
  };
  const result = await runDecision({
    id: spec.id ?? `decision-${now.toISOString().replace(/[:.]/g, '-')}`,
    problem: spec.problem,
    profile: spec.profile,
    mode,
    proposer: new LlmProposer(proposerClient),
    debater: (seat, _proposal, boutId) => new LlmAgent(debaterClient(seat, boutId), { maxTurns }),
    judge,
    ...(spec.statusQuo ? { statusQuo: { seat: 'status-quo', ...spec.statusQuo } } : {}),
    ...(seats ? { seats } : {}),
    ...(spec.prefer ? { prefer: spec.prefer } : {}),
    ...(spec.homeWing ? { homeWing: spec.homeWing } : {}),
    ...(journal ? { credibilityPriors: journal.credibilityPriors() } : {}),
    ...(store ? { fighters: store } : {}),
    runner: {
      maxTurns: maxTurns * 2,
      now: () => now,
      resume: checkpoint,
      onProposal: (p) => {
        if (!checkpoint.proposals.some((x) => x.seat === p.seat)) {
          checkpoint.proposals.push(p);
          saveCheckpoint();
          io.log(`  proposal ${getGenius(p.seat).name}: ${p.answer}`);
        }
      },
      onBout: (b) => {
        const w = b.replay.winner === 'A' ? b.A.name : b.replay.winner === 'B' ? b.B.name : 'draw';
        if (!b.resumed) {
          checkpoint.bouts.push({ id: b.id, replay: b.replay });
          saveCheckpoint();
        }
        io.log(`  bout ${b.id}: ${b.A.name} vs ${b.B.name} → ${w}${b.resumed ? ' (resumed)' : ''}`);
      },
    },
  });

  const record = decisionRecord(result, now);
  const md = renderDecisionMarkdown(record);
  io.log(md);
  const outPath = flagString(flags, 'out');
  if (outPath) {
    writeFileSync(outPath, md, 'utf8');
    io.log(`wrote ${outPath}`);
  }
  if (journal && journalPath) {
    journal.add(record);
    journal.save(journalPath);
    io.log(`journaled ${record.id} → ${journalPath}`);
  }
  if (store) {
    store.writeIndex();
    io.log(`fighter growth saved → ${store.root}`);
  }
  return 0;
}

async function arena(file: string, flags: Flags, io: CliIo): Promise<number> {
  const spec = readJson<ArenaFile>(file);
  if (!Array.isArray(spec.entrants) || !Array.isArray(spec.topics)) {
    throw new Error(`${file}: needs "entrants" and "topics" arrays`);
  }
  const offline = flags.offline === true;
  const entrants: ArenaEntrant[] = spec.entrants.map((e, i) => ({
    id: e.id,
    ...(e.archetypeId !== undefined ? { archetypeId: e.archetypeId } : {}),
    client: offline
      ? new MockChatClient({ seed: i + 1, ...e.mock })
      : onlineClient(io.env, {
          ...(e.model !== undefined ? { model: e.model } : {}),
          ...(e.baseUrl !== undefined ? { baseUrl: e.baseUrl } : {}),
          ...(e.apiKeyEnv !== undefined ? { apiKeyEnv: e.apiKeyEnv } : {}),
        }),
  }));
  const store = rosterStore(flags);
  const result = await benchmarkAgents({
    entrants,
    ...(store ? { fighters: store, now: io.now } : {}),
    topics: spec.topics,
    judge: offline ? new HeuristicJudge() : onlineJudge(io.env),
    ...(spec.rounds !== undefined ? { rounds: spec.rounds } : {}),
    ...(spec.maxTurns !== undefined ? { maxTurns: spec.maxTurns } : {}),
    ...(spec.id !== undefined ? { id: spec.id } : {}),
    onMatch: (m) => io.log(`  ${m.id}: ${m.A} vs ${m.B} on "${m.topic}" → ${m.winner ?? 'draw'}`),
  });
  io.log('');
  io.log(renderScorecards(result.scorecards));
  if (store) {
    store.writeIndex();
    io.log(`fighter growth saved → ${store.root}`);
  }
  return 0;
}

function brier(file: string, io: CliIo): number {
  const journal = DecisionJournal.load(file);
  const scores = journal.brierScores();
  const priors = journal.credibilityPriors();
  const seats = Object.keys(scores);
  if (seats.length === 0) io.log('No resolved predictions yet.');
  for (const seat of seats) {
    const s = scores[seat]!;
    io.log(`${seat.padEnd(24)} brier ${s.brier.toFixed(3)}  n=${s.n}  prior ${(priors[seat] ?? 0).toFixed(2)}`);
  }
  io.log(`${journal.pending().length} prediction(s) awaiting resolution.`);
  return 0;
}

function rosterInit(flags: Flags, io: CliIo): number {
  const store = new FileFighterStore(flagString(flags, 'dir') ?? DEFAULT_ROSTER_DIR);
  const created = store.ensureAll();
  const index = store.writeIndex();
  const total = store.all().length;
  io.log(`roster ready: ${total} fighters in ${store.root} (${created} created, ${total - created} kept)`);
  io.log(`standings → ${index}`);
  return 0;
}

function roster(flags: Flags, io: CliIo): number {
  const store = new FileFighterStore(flagString(flags, 'dir') ?? DEFAULT_ROSTER_DIR);
  const topFlag = flagString(flags, 'top');
  const top = topFlag !== undefined ? parsePositiveInt(topFlag, '--top') : undefined;
  io.log(renderStandingsTable(store.standings(), top));
  return 0;
}

function fighter(slug: string, flags: Flags, io: CliIo): number {
  getGenius(slug); // throws a clear error for unknown slugs
  const store = new FileFighterStore(flagString(flags, 'dir') ?? DEFAULT_ROSTER_DIR);
  io.log(renderFighterLog(store.get(slug)).trimEnd());
  return 0;
}

async function train(flags: Flags, io: CliIo): Promise<number> {
  const store = new FileFighterStore(flagString(flags, 'dir') ?? DEFAULT_ROSTER_DIR);
  const bouts = parsePositiveInt(flagString(flags, 'bouts') ?? '20', '--bouts');
  const seed = parsePositiveInt(flagString(flags, 'seed') ?? '1', '--seed');
  const turns = parsePositiveInt(flagString(flags, 'turns') ?? '3', '--turns');
  const pairing = (flagString(flags, 'pairing') ?? 'random') as Pairing;
  if (!PAIRINGS.includes(pairing)) throw new Error(`--pairing must be one of ${PAIRINGS.join(', ')} (got ${pairing})`);
  const nowFlag = flagString(flags, 'now');
  const start = nowFlag !== undefined ? new Date(nowFlag) : io.now();
  if (Number.isNaN(start.getTime())) throw new Error(`--now must be an ISO date (got ${nowFlag})`);
  const topics = readJson<ArenaTopic[]>(flagString(flags, 'topics') ?? DEFAULT_TOPICS);
  const offline = flags.offline === true;

  let clientFor: (slug: string, boutId: string) => ChatClient;
  let judge: Judge;
  if (offline) {
    clientFor = (slug, boutId) => new MockChatClient({ seed: hash(`${slug}|${boutId}`), ...offlinePersonality(slug) });
    judge = new HeuristicJudge();
  } else {
    const client = onlineClient(io.env);
    clientFor = () => client;
    judge = onlineJudge(io.env);
  }

  store.ensureAll();
  const summary = await trainingCamp({
    store,
    bouts,
    seed,
    pairing,
    judge,
    clientFor,
    topics,
    maxTurns: turns,
    id: `camp-${start.toISOString().slice(0, 10)}-s${seed}`,
    now: () => start,
    onBout: (b) => {
      const w = b.winner ? getGenius(b.winner).name : 'draw';
      io.log(`  ${b.id}: ${getGenius(b.A).name} vs ${getGenius(b.B).name} → ${w}`);
    },
  });
  store.writeIndex();
  io.log('');
  io.log(renderTrainingSummary(summary));
  io.log(`careers saved → ${store.root}`);
  return 0;
}

const DEFAULT_TOPICS = fileURLToPath(new URL('../examples/topics.json', import.meta.url));

/**
 * Offline stand-in minds: a deterministic temperament per genius, so some
 * fighters start sloppier than others and training has something to fix.
 */
export function offlinePersonality(slug: string): MockChatClientOptions {
  const h = hash(`temperament:${slug}`);
  return {
    personality: h % 6 === 0 ? 'sloppy' : 'good',
    fallacyRate: [0, 0.1, 0.25, 0.4, 0.55][h % 5]!,
  };
}

function rosterStore(flags: Flags): FileFighterStore | undefined {
  const v = flags.roster;
  if (v === undefined) return undefined;
  if (v === true) throw new Error('--roster needs a directory, e.g. --roster data/fighters');
  return new FileFighterStore(v);
}

function parsePositiveInt(v: string, name: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer (got ${v})`);
  return n;
}

/* ------------------------------------------------------------------ */

function onlineClient(
  env: Record<string, string | undefined>,
  o: { model?: string; baseUrl?: string; apiKeyEnv?: string } = {},
): OpenAiChatClient {
  const apiKey = o.apiKeyEnv !== undefined
    ? env[o.apiKeyEnv]
    : env.VK_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      `No API key: set ${o.apiKeyEnv ?? 'VK_API_KEY'} (or OPENAI_API_KEY), or pass --offline to use mock agents.`,
    );
  }
  const baseUrl = o.baseUrl ?? env.VK_BASE_URL ?? env.OPENAI_BASE_URL;
  return new OpenAiChatClient({
    apiKey,
    model: o.model ?? env.VK_MODEL ?? env.OPENAI_MODEL ?? 'gpt-4o-mini',
    ...(baseUrl !== undefined ? { baseUrl } : {}),
  });
}

function onlineJudge(env: Record<string, string | undefined>): Judge {
  const models = (env.VK_JUDGE_MODELS ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  if (models.length <= 1) {
    const model = models[0];
    return new LlmJudge(onlineClient(env, model !== undefined ? { model } : {}));
  }
  return new EnsembleJudge(models.map((model) => new LlmJudge(onlineClient(env, { model }))));
}

type Flags = Record<string, string | true>;

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split('=', 2) as [string, string | undefined];
    if (inline !== undefined) flags[key] = inline;
    else if (key === 'offline') flags[key] = true;
    else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    }
  }
  return { positional, flags };
}

function flagString(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}

function parseMode(m: string): CouncilMode {
  if (m === 'quick' || m === 'council' || m === 'full') return m;
  throw new Error(`--mode must be quick, council or full (got ${m})`);
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
