"use strict";

const Anthropic = require("@anthropic-ai/sdk");
const { REFEREE_SYSTEM, REFEREE_SCHEMA, PERSONA_SYSTEM } = require("./prompts");

const MODEL = process.env.VK_MODEL || "claude-opus-4-8";

// Zero-arg client: resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
// `ant auth login` profile from the environment.
let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function hasEnvCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const FALLACY_NAMES = new Set([
  "AD HOMINEM", "STRAWMAN", "SLIPPERY SLOPE", "WHATABOUTISM",
  "APPEAL TO EMOTION", "CIRCULAR REASONING", "FALSE DILEMMA", "BANDWAGON",
  "APPEAL TO AUTHORITY", "RED HERRING", "TU QUOQUE", "HASTY GENERALIZATION",
  "DISQUALIFIED",
]);

/**
 * Score one argument. Returns
 * {classification, fallacy_name, quality, receipt} or {disqualified: true}.
 */
async function referee({ argument, topic, speaker, stance, opponent, opponentStance }) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium", // latency-sensitive: one verdict per combat exchange
      format: { type: "json_schema", schema: REFEREE_SCHEMA },
    },
    system: REFEREE_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `THE QUESTION: ${topic}?\n` +
          `SPEAKER: ${speaker} — arguing: ${stance}\n` +
          `OPPONENT: ${opponent} — arguing: ${opponentStance}\n\n` +
          `THE ARGUMENT TO JUDGE:\n${argument}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return { disqualified: true };

  const text = response.content.find((b) => b.type === "text");
  const verdict = JSON.parse(text.text);
  // Schema can't carry numeric bounds — clamp server-side.
  verdict.quality = Math.max(0, Math.min(100, Math.round(verdict.quality)));
  verdict.fallacy_name = FALLACY_NAMES.has(verdict.fallacy_name)
    ? verdict.fallacy_name
    : verdict.classification === "fallacy" ? "STRAWMAN" : "";
  return verdict;
}

/**
 * Generate one in-character argument line. `move` is jab|hook|zing, or a
 * fallacy name when the game has decided this line whiffs. Returns {line}.
 */
async function personaLine({ fighter, opponent, topic, move, fallacy, recent }) {
  const moveSpec = fallacy ? fallacy : { jab: "jab", hook: "hook", zing: "zing" }[move] || "zing";
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: PERSONA_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `FIGHTER: ${fighter.name} (${fighter.tag || "challenger"})\n` +
          `FIGHTER'S STANCE: ${fighter.stance}\n` +
          `OPPONENT: ${opponent.name} — arguing: ${opponent.stance}\n` +
          `THE QUESTION: ${topic}?\n` +
          `MOVE TYPE: ${moveSpec}\n` +
          `RECENT LINES (do not repeat):\n${(recent || []).map((l) => `- ${l}`).join("\n") || "- (none)"}\n\n` +
          `Write ${fighter.name}'s next line.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return { disqualified: true };

  const text = response.content.find((b) => b.type === "text");
  return { line: (text ? text.text : "").trim() };
}

module.exports = { referee, personaLine, hasEnvCredentials, MODEL };
