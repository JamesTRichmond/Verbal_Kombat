"use strict";

const path = require("path");
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { referee, personaLine, hasEnvCredentials, MODEL } = require("./engine");

const PORT = process.env.PORT || 3141;

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "..")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, live: hasEnvCredentials(), model: MODEL });
});

function requireFields(body, fields, res) {
  const missing = fields.filter((f) => !body || body[f] == null || body[f] === "");
  if (missing.length) {
    res.status(400).json({ error: `missing fields: ${missing.join(", ")}` });
    return false;
  }
  return true;
}

// Map SDK errors to game-friendly responses. Most-specific first; the client
// falls back to the offline template engine on any non-2xx.
function handleApiError(res, err) {
  // Thrown at request-build time when the zero-arg client finds no key,
  // auth token, or `ant` profile in the environment.
  if (err instanceof Error && /resolve authentication/i.test(err.message)) {
    return res.status(503).json({ error: "no Anthropic credentials on the server" });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return res.status(503).json({ error: "no valid Anthropic credentials on the server" });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return res.status(503).json({ error: "rate limited — the referee needs a breather" });
  }
  if (err instanceof Anthropic.APIError) {
    return res.status(502).json({ error: `upstream error (${err.status ?? "?"})` });
  }
  console.error(err);
  return res.status(500).json({ error: "referee engine fault" });
}

app.post("/api/referee", async (req, res) => {
  if (!requireFields(req.body, ["argument", "topic", "speaker", "stance"], res)) return;
  if (String(req.body.argument).length > 600) {
    return res.status(400).json({ error: "argument too long (600 chars max)" });
  }
  try {
    const verdict = await referee({
      argument: String(req.body.argument),
      topic: String(req.body.topic),
      speaker: String(req.body.speaker),
      stance: String(req.body.stance),
      opponent: String(req.body.opponent || "the opposition"),
      opponentStance: String(req.body.opponentStance || "the opposite"),
    });
    if (verdict.disqualified) {
      return res.status(422).json({ error: "topic disqualified by the arena" });
    }
    res.json(verdict);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/persona", async (req, res) => {
  if (!requireFields(req.body, ["fighter", "opponent", "topic", "move"], res)) return;
  try {
    const result = await personaLine({
      fighter: req.body.fighter,
      opponent: req.body.opponent,
      topic: String(req.body.topic),
      move: String(req.body.move),
      fallacy: req.body.fallacy ? String(req.body.fallacy) : null,
      recent: Array.isArray(req.body.recent) ? req.body.recent.slice(-8).map(String) : [],
    });
    if (result.disqualified) {
      return res.status(422).json({ error: "topic disqualified by the arena" });
    }
    res.json(result);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.listen(PORT, () => {
  const live = hasEnvCredentials();
  console.log(`VERBAL KOMBAT arena on http://localhost:${PORT}`);
  console.log(
    live
      ? `LIVE AI mode armed (model: ${MODEL})`
      : "No ANTHROPIC_API_KEY found — serving the game in offline template mode.",
  );
});
