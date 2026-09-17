import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main } from './cli.js';

const examples = fileURLToPath(new URL('../examples', import.meta.url));

function capture() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    io: { log: (l: string) => void lines.push(l), error: (l: string) => void errors.push(l), env: {}, now: () => new Date('2026-09-16T00:00:00Z') },
  };
}

describe('lab CLI (offline)', () => {
  it('decide writes a markdown report and journals the record', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-cli-'));
    try {
      const out = join(dir, 'report.md');
      const journal = join(dir, 'journal.json');
      const c = capture();
      const code = await main(
        ['decide', join(examples, 'problem.json'), '--offline', '--mode', 'quick', '--out', out, '--journal', journal],
        c.io,
      );
      expect(c.errors).toEqual([]);
      expect(code).toBe(0);
      expect(readFileSync(out, 'utf8')).toMatch(/^# Decision: /);
      expect(c.lines.join('\n')).toMatch(/Status quo/);
      const saved = JSON.parse(readFileSync(journal, 'utf8'));
      expect(saved.entries[0].record.id).toBe('example-portfolio-decision');

      const b = capture();
      expect(await main(['brier', journal], b.io)).toBe(0);
      expect(b.lines.join('\n')).toMatch(/awaiting resolution/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('arena prints a scorecard table', async () => {
    const c = capture();
    const code = await main(['arena', join(examples, 'arena.json'), '--offline'], c.io);
    expect(code).toBe(0);
    const text = c.lines.join('\n');
    expect(text).toMatch(/entrant\s+elo/);
    const rows = text.split('\n').filter((l) => /^(careful|sloppy)-bot\s/.test(l));
    expect(rows[0]).toMatch(/^careful-bot/);
  });

  it('fails cleanly without a key online, and on bad usage', async () => {
    const c = capture();
    expect(await main(['arena', join(examples, 'arena.json')], c.io)).toBe(1);
    expect(c.errors.join('\n')).toMatch(/No API key/);
    const u = capture();
    expect(await main([], u.io)).toBe(2);
    expect(await main(['decide', join(examples, 'problem.json'), '--offline', '--mode', 'huge'], u.io)).toBe(1);
  });

  it('roster init, train, roster and fighter work end to end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-cli-roster-'));
    try {
      const init = capture();
      expect(await main(['roster', 'init', '--dir', dir], init.io)).toBe(0);
      expect(init.lines[0]).toMatch(/186 fighters .*\(186 created, 0 kept\)/);
      expect(existsSync(join(dir, 'README.md'))).toBe(true);

      const t = capture();
      const args = ['train', '--offline', '--bouts', '6', '--seed', '7', '--dir', dir, '--now', '2026-09-16T12:00:00Z'];
      expect(await main(args, t.io)).toBe(0);
      const text = t.lines.join('\n');
      expect(text).toMatch(/Training camp: 6 bouts · \d+ fighters · \+\d+ XP · \d+ new lessons · \d+ level-ups/);
      expect(t.lines.filter((l) => /camp-2026-09-16-s7-b\d+:/.test(l))).toHaveLength(6);

      const again = capture();
      expect(await main(['roster', 'init', '--dir', dir], again.io)).toBe(0);
      expect(again.lines[0]).toMatch(/\(0 created, 186 kept\)/);

      const r = capture();
      expect(await main(['roster', '--dir', dir, '--top', '3'], r.io)).toBe(0);
      const rows = r.lines.join('\n').split('\n').slice(2);
      expect(rows).toHaveLength(3);
      const topName = rows[0]!.split(/\s{2,}/)[1]!;

      const top = readFileSync(join(dir, 'README.md'), 'utf8').match(/\| 1 \| \[[^\]]+\]\(([^)]+)\.md\)/)![1]!;
      const f = capture();
      expect(await main(['fighter', top, '--dir', dir], f.io)).toBe(0);
      expect(f.lines[0]!.split('\n')[0]).toBe(`# ${topName}`);
      expect(f.lines.join('\n')).toMatch(/## Bout log \([1-9]/);

      const bad = capture();
      expect(await main(['fighter', 'nobody-at-all', '--dir', dir], bad.io)).toBe(1);
      expect(await main(['train', '--offline', '--pairing', 'chaos', '--dir', dir], bad.io)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('decide and arena persist growth with --roster', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-cli-grow-'));
    try {
      const roster = join(dir, 'fighters');
      const d = capture();
      expect(await main(['decide', join(examples, 'problem.json'), '--offline', '--roster', roster], d.io)).toBe(0);
      expect(d.lines.join('\n')).toMatch(/fighter growth saved/);
      const standings = readFileSync(join(roster, 'README.md'), 'utf8');
      expect(standings).toMatch(/\| 1 \| .* \| [1-9]\d* \| \d+-\d+-\d+ \|/);

      const arenaFile = join(dir, 'arena.json');
      writeFileSync(
        arenaFile,
        JSON.stringify({
          maxTurns: 2,
          topics: [{ topic: 'Is homework useful?', stances: { A: 'Yes', B: 'No' } }],
          entrants: [
            { id: 'hypatia', archetypeId: 'genius:hypatia', mock: { seed: 1 } },
            { id: 'bot', mock: { seed: 2, personality: 'sloppy' } },
          ],
        }),
        'utf8',
      );
      const a = capture();
      expect(await main(['arena', arenaFile, '--offline', '--roster', roster], a.io)).toBe(0);
      const hyp = JSON.parse(readFileSync(join(roster, 'hypatia.json'), 'utf8'));
      expect(hyp.log).toHaveLength(2);
      expect(hyp.log[0].opponent).toBe('bot');
      expect(existsSync(join(roster, 'bot.json'))).toBe(false);

      const e = capture();
      expect(await main(['arena', arenaFile, '--offline', '--roster'], e.io)).toBe(1);
      expect(e.errors.join('\n')).toMatch(/--roster needs a directory/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
