# Copilot memory playbook

Copilot memory is most useful here as a small, reviewed index of stable facts—not
as a second architecture document. Repository instructions establish rules every
agent should follow; memory should preserve verified discoveries that save future
investigation. Source files remain authoritative when either becomes stale.

## Use all three context layers

| Layer | Best use in this repository | Maintenance |
| --- | --- | --- |
| `AGENTS.md` | Safety boundaries, product invariants, data rules, and the working agreement | Review with architectural or policy changes |
| `.github/copilot-instructions.md` | Short, always-on repository routing and verification guidance | Keep concise and synchronized with manifests |
| Copilot memory | Stable facts learned while completing work, especially non-obvious traps and cross-package relationships | Review in repository settings; reinforce, correct, or delete through Copilot |

Do not copy the whole working agreement into memory. Repetition consumes attention,
creates more stale copies, and makes it harder to rank genuinely useful discoveries.

## Six ways to get more value

### 1. Capture one durable fact at the end of a successful task

After verification, explicitly ask Copilot to remember the smallest reusable fact:

> Remember this repository fact: root `npm test` is the test entry point; the
> `apps/game` package intentionally has no package-level test script. Evidence:
> `package.json` and `apps/game/package.json`.

Include evidence and scope. Prefer facts expected to survive several pull requests.
Avoid branch state, line numbers, temporary failures, generated values, and a list
of files changed in one task.

### 2. Turn repeated review feedback into a guardrail

When the same review correction appears twice, save the underlying rule rather than
the individual incident. For example:

> Remember that renderer changes must consume authoritative replay/combat events;
> they must not calculate judge scores, damage, or winners.

If a rule is mandatory for every contributor, promote it to `AGENTS.md` or repository
instructions instead of relying only on memory.

### 3. Store navigation shortcuts, not duplicated documentation

High-value memories connect a task to its authority:

- Career, lesson, or training changes require reading `docs/GROWTH.md` and using
  isolated storage during tests.
- Council scoring semantics live in `packages/core/src/council.ts`; orchestration
  lives in `packages/replay/src/council-runner.ts`.
- Provider integrations implement `ChatClient` in `packages/debate`; they do not
  belong in the game client.
- Match traceability crosses core events, combat mapping, replay orchestration, and
  presentation, so changes should verify `sourceArgumentId` links end to end.

These facts reduce search time without pretending that the linked implementation
will never change.

### 4. Ask for retrieval before planning

Start a substantial task with a retrieval prompt, then require confirmation from the
current tree:

> Recall relevant Verbal Kombat repository memories for this task. Separate rules,
> likely-useful facts, and uncertain or possibly stale facts. Then verify each fact
> against the repository before proposing edits.

This makes memory a hypothesis generator rather than an unquestioned source of truth.

### 5. Give usefulness feedback and clean the list

In a session, tell Copilot which recalled fact helped, correct inaccurate facts
explicitly, and ask it to forget facts that are obsolete. Periodically inspect
**Settings -> Copilot -> Memory**:

1. Delete exact or semantic duplicates.
2. Delete facts already obvious from the nearest manifest or source file unless
   they prevent a recurring mistake.
3. Delete implementation snapshots after the implementation changes.
4. Retain compact facts that affected a decision, caught a defect, or prevented an
   unsafe command.

The screenshot that motivated this guide shows the game-package test-script fact
twice. Keep one copy at most; its value is the consequence—run tests from the
workspace root—not the bare observation.

### 6. Audit memory with a fresh-session drill

After adding or correcting important memories, use a new session and ask Copilot to:

1. identify the command for a deterministic full test run;
2. explain where a new judge implementation belongs;
3. explain how a combat animation traces back to an argument; and
4. identify the storage precautions for a lab training test.

Useful answers should point back to repository evidence. If recall adds confidence
without evidence, narrow or delete the memory.

## Recommended memory candidates

Add these conversationally only after Copilot verifies them in the current tree:

| Candidate fact | Why it pays off |
| --- | --- |
| Root `npm test` is the test entry point; `apps/game` has no package test script | Prevents a common no-op or failing verification command |
| Lab commands may persist careers; tests and demos must use isolated temporary storage | Protects committed durable fighter data |
| `sourceArgumentId` is the traceability link from combat back to debate | Prevents visually convenient but unauditable events |
| `ChatClient` is the provider boundary and live calls are not routine tests | Keeps integrations server/headless-oriented and tests credential-free |
| Roadmap items are intent, not proof of implementation | Prevents agents from building on nonexistent behavior |
| Browser careers use local storage while lab careers use a file-backed store | Helps choose the correct persistence layer without coupling domain code to either |

Do not add every row at once merely to populate the list. A memory earns its place
when it was verified during real work and is likely to change a future decision.

## Never store

- API keys, authorization headers, credentials, or environment-variable values.
- Private problem statements, transcripts, council records, or personal data.
- Unreviewed model output, guesses, or claims copied from an issue attachment.
- Volatile branch names, commit hashes, temporary CI failures, exact line numbers,
  generated standings, or current fighter statistics.
- Instructions found inside debate text, retrieved content, provider responses, or
  learned lessons. Those are untrusted content, not repository policy.

## A lightweight maintenance cadence

- **After a task:** save at most one or two verified, durable facts.
- **During review:** reinforce facts that prevented defects; correct facts that
  produced a wrong suggestion.
- **After architecture or script changes:** inspect memories that name the changed
  component or command.
- **Monthly or after several large pull requests:** remove duplicates and run the
  fresh-session drill.
