/**
 * vk lab CLI.
 *
 *   npm run lab -- decide <problem.json> [--mode quick|council|full] [--offline] [--out report.md] [--journal journal.json]
 *   npm run lab -- arena  <arena.json>  [--offline]
 *   npm run lab -- brier  <journal.json>
 *
 * Online configuration (OpenAI-compatible endpoint) comes from env:
 *   VK_API_KEY   (or OPENAI_API_KEY)   required online
 *   VK_BASE_URL  (or OPENAI_BASE_URL)  default https://api.openai.com/v1
 *   VK_MODEL     (or OPENAI_MODEL)     default gpt-4o-mini
 *   VK_JUDGE_MODELS  comma-separated; >1 model → EnsembleJudge
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  getGenius,
  type CouncilMode,
  type Genius,
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
  '  npm run lab -- decide <problem.json> [--mode quick|council|full] [--offline] [--out report.md] [--journal journal.json]',
  '  npm run lab -- arena <arena.json> [--offline]',
  '  npm run lab -- brier <journal.json>',
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
    runner: {
      maxTurns: maxTurns * 2,
      onBout: (b) => {
        const w = b.replay.winner === 'A' ? b.A.name : b.replay.winner === 'B' ? b.B.name : 'draw';
        io.log(`  bout ${b.id}: ${b.A.name} vs ${b.B.name} → ${w}`);
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
  const result = await benchmarkAgents({
    entrants,
    topics: spec.topics,
    judge: offline ? new HeuristicJudge() : onlineJudge(io.env),
    ...(spec.rounds !== undefined ? { rounds: spec.rounds } : {}),
    ...(spec.maxTurns !== undefined ? { maxTurns: spec.maxTurns } : {}),
    ...(spec.id !== undefined ? { id: spec.id } : {}),
    onMatch: (m) => io.log(`  ${m.id}: ${m.A} vs ${m.B} on "${m.topic}" → ${m.winner ?? 'draw'}`),
  });
  io.log('');
  io.log(renderScorecards(result.scorecards));
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

/* ------------------------------------------------------------------ */

function onlineClient(
  env: Record<string, string | undefined>,
  o: { model?: string; baseUrl?: string; apiKeyEnv?: string } = {},
): OpenAiChatClient {
  const apiKey = (o.apiKeyEnv ? env[o.apiKeyEnv] : undefined) ?? env.VK_API_KEY ?? env.OPENAI_API_KEY;
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
