import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
});
