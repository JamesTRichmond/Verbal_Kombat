/**
 * Minimal ambient declarations for the Node built-ins the lab uses.
 * The monorepo ships without @types/node (no new deps); if it is ever
 * added, delete this file.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, encoding?: 'utf8'): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, opts?: { recursive?: boolean; force?: boolean }): void;
}

declare module 'node:path' {
  export function dirname(p: string): string;
  export function resolve(...parts: string[]): string;
  export function join(...parts: string[]): string;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:url' {
  export function pathToFileURL(path: string): { href: string };
  export function fileURLToPath(url: string | URL): string;
}

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number | undefined;
  cwd(): string;
};

interface ImportMeta {
  url: string;
}
