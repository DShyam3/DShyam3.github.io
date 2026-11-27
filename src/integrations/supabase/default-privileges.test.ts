import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * anon gets nothing by default on new tables, sequences or functions.
 *
 * Default privileges decide what every future object grants before anyone
 * writes a GRANT for it, so a default that gives anon rights opens each new
 * object silently. A pg_dump re-baseline writes them back as GRANT ALL ... TO
 * "anon" (20260904130000_baseline.sql did). The migration that closed them
 * checks the catalog once, when applied; this keeps a later file from undoing
 * it. Migrations are replayed in order, and schemas/ is checked on its own.
 */

type Statement = { action: 'grant' | 'revoke'; schema: string | null; kind: string; grantees: string[] };

const sqlOf = (dir: string): string[] =>
  readdirSync(resolve(process.cwd(), dir))
    .filter(name => name.endsWith('.sql'))
    .sort()
    .map(name => readFileSync(resolve(process.cwd(), dir, name), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\n]*/g, ''));

const STATEMENT =
  /alter\s+default\s+privileges\s+for\s+role\s+"?(\w+)"?\s+(?:in\s+schema\s+"?(\w+)"?\s+)?(grant|revoke)\s+[\w\s,]+?\s+on\s+(tables|sequences|functions)\s+(?:to|from)\s+([^;]+);/gi;

/** postgres's default-privilege statements, in order. Fails on one it cannot read rather than skipping it. */
const statementsIn = (files: string[]): Statement[] => {
  const text = files.join('\n');
  const parsed = [...text.matchAll(STATEMENT)];
  expect(parsed.length, 'an ALTER DEFAULT PRIVILEGES statement the parser cannot read')
    .toBe(text.match(/alter\s+default\s+privileges/gi)?.length ?? 0);
  return parsed
    .filter(([, role]) => role.toLowerCase() === 'postgres')
    .map(([, , schema, action, kind, grantees]) => ({
      action: action.toLowerCase() as Statement['action'],
      schema: schema?.toLowerCase() ?? null,
      kind: kind.toLowerCase(),
      grantees: grantees.split(',').map(g => g.trim().replace(/"/g, '').toLowerCase()),
    }));
};

/** The action of the last statement naming `grantee` for `kind` in `schema`. */
const lastFor = (statements: Statement[], schema: string | null, kind: string, grantee: string) =>
  statements.filter(s => s.schema === schema && s.kind === kind && s.grantees.includes(grantee)).at(-1)?.action;

describe.each([
  ['migrations, replayed in order', 'supabase/migrations'],
  ['schemas/', 'supabase/schemas'],
])('default privileges in %s', (_label, dir) => {
  const statements = statementsIn(sqlOf(dir));

  it.each(['tables', 'sequences', 'functions'])('end with anon revoked on new %s in public', kind => {
    expect(lastFor(statements, 'public', kind, 'anon')).toBe('revoke');
  });

  it('end with PUBLIC revoked on new functions, globally', () => {
    expect(lastFor(statements, null, 'functions', 'public')).toBe('revoke');
  });
});
