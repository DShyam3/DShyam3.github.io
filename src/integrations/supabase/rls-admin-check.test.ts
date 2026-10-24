import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every policy that asks `public.is_admin()` must ask it as
 * `(SELECT public.is_admin())`.
 *
 * The function is SECURITY DEFINER with a pinned search_path, so the planner
 * cannot inline it. Called bare in a policy it runs once for every row the
 * policy tests; wrapped in a scalar subquery it becomes an InitPlan that runs
 * once per statement. The answer is identical, which is the trouble: a bare
 * call slips back in unnoticed, and the only symptom is a large read slowing
 * down (performance/README.md has the measurement).
 *
 * Policies live in two places. `schemas/` is the declarative source for the
 * public tables; storage.objects policies exist only in `migrations/`. So the
 * migrations are replayed in order -- CREATE, ALTER and DROP POLICY -- to get
 * the text each policy holds after the last one, and `schemas/` is checked on
 * its own.
 */

type Policy = { using?: string; check?: string };
type SqlFile = { name: string; sql: string };

const sqlFiles = (dir: string): SqlFile[] =>
  readdirSync(resolve(process.cwd(), dir))
    .filter(name => name.endsWith('.sql'))
    .sort()
    .map(name => ({
      name,
      sql: readFileSync(resolve(process.cwd(), dir, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/--[^\n]*/g, ''),
    }));

const POLICY_STATEMENT =
  /\b(create|alter|drop)\s+policy\s+(?:if\s+exists\s+)?(?:"([^"]+)"|(\w+))\s+on\s+((?:"?\w+"?\.)?"?\w+"?)([^;]*);/gi;
/** Every policy statement, parsed or not -- so one the parser cannot read fails loudly instead of being skipped. */
const POLICY_KEYWORD = /\b(?:create|alter|drop)\s+policy\b/gi;
const USING = /\busing\s*\(/i;
const WITH_CHECK = /\bwith\s+check\s*\(/i;

const tableOf = (raw: string) => {
  const name = raw.replace(/"/g, '').toLowerCase();
  return name.includes('.') ? name : `public.${name}`;
};

/** The parenthesised expression after `keyword`, or undefined when the statement has no such clause. */
const clause = (body: string, keyword: RegExp): string | undefined => {
  const match = keyword.exec(body);
  if (!match) return undefined;
  const start = match.index + match[0].length - 1;
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')' && --depth === 0) return body.slice(start, i + 1);
  }
  throw new Error(`Unbalanced parentheses in policy: ${body}`);
};

/** Each policy's USING and WITH CHECK text after every file has run, keyed `schema.table "name"`. */
const replay = (files: SqlFile[]) => {
  const policies = new Map<string, Policy>();
  for (const { name: file, sql } of files) {
    const statements = [...sql.matchAll(POLICY_STATEMENT)];
    const keywords = sql.match(POLICY_KEYWORD)?.length ?? 0;
    if (statements.length !== keywords) {
      throw new Error(`${file}: could not parse ${keywords - statements.length} policy statement(s)`);
    }
    for (const [, verb, quoted, unquoted, table, body] of statements) {
      const key = `${tableOf(table)} "${quoted ?? unquoted.toLowerCase()}"`;
      const action = verb.toLowerCase();
      if (action === 'drop') {
        policies.delete(key);
      } else if (action === 'create') {
        policies.set(key, { using: clause(body, USING), check: clause(body, WITH_CHECK) });
      } else {
        const current = policies.get(key);
        if (!current) throw new Error(`ALTER POLICY on a policy no migration created: ${key}`);
        policies.set(key, {
          using: clause(body, USING) ?? current.using,
          check: clause(body, WITH_CHECK) ?? current.check,
        });
      }
    }
  }
  return policies;
};

/** `(SELECT public.is_admin())` as written, or as Postgres deparses it: `( SELECT "public"."is_admin"() AS "is_admin")`. */
const WRAPPED =
  /\(\s*select\s+(?:"?public"?\s*\.\s*)?"?is_admin"?\s*\(\s*\)(?:\s+as\s+"?is_admin"?)?\s*\)/gi;
const callsBare = (expression?: string) =>
  expression !== undefined && /is_admin/i.test(expression.replace(WRAPPED, ''));

/** Keys of the policies that call is_admin() anywhere other than inside `(SELECT ...)`. */
const bareCalls = (policies: Map<string, Policy>) =>
  [...policies]
    .filter(([, { using, check }]) => callsBare(using) || callsBare(check))
    .map(([key]) => key);

const adminGated = (policies: Map<string, Policy>, schema: string) =>
  [...policies].filter(([key, { using, check }]) =>
    key.startsWith(`${schema}.`) && /is_admin/i.test(`${using} ${check}`));

describe('policies ask is_admin() once per statement', () => {
  const migrations = sqlFiles('supabase/migrations');
  const file = (sql: string): SqlFile => ({ name: 'inline.sql', sql });

  it('reads every spelling of the wrapped call as wrapped, including what pg_dump emits', () => {
    for (const wrapped of [
      '((SELECT "public"."is_admin"()))',
      '(( SELECT "public"."is_admin"() AS "is_admin"))',
      '(( SELECT is_admin() AS is_admin))',
      "((bucket_id = 'photos'::text) AND ( SELECT public.is_admin() AS is_admin))",
    ]) expect(callsBare(wrapped), wrapped).toBe(false);
    expect(callsBare('("public"."is_admin"())')).toBe(true);
    expect(callsBare("(bucket_id = 'photos' AND public.is_admin())")).toBe(true);
  });

  it('reads unquoted policy names, and refuses a policy statement it cannot parse', () => {
    const unquoted = replay([file('CREATE POLICY admin_only ON public.t USING (public.is_admin());')]);
    expect(bareCalls(unquoted)).toEqual(['public.t "admin_only"']);
    expect(() => replay([file("EXECUTE format('CREATE POLICY %I ON %I USING (true)', a, b);")]))
      .toThrow(/could not parse 1 policy statement/);
  });

  it('detects a bare call, so a pass is not vacuous', () => {
    const baseline = bareCalls(replay(migrations.slice(0, 1)));
    expect(baseline.some(key => key.startsWith('public.'))).toBe(true);
    expect(baseline.some(key => key.startsWith('storage.objects '))).toBe(true);
  });

  it('leaves no bare call in any policy once every migration has run', () => {
    const policies = replay(migrations);
    expect(adminGated(policies, 'public').length).toBeGreaterThan(0);
    expect(adminGated(policies, 'storage').length).toBeGreaterThan(0);
    expect(bareCalls(policies)).toEqual([]);
  });

  it('leaves no bare call in the declarative schema', () => {
    const policies = replay(sqlFiles('supabase/schemas'));
    expect(adminGated(policies, 'public').length).toBeGreaterThan(0);
    expect(bareCalls(policies)).toEqual([]);
  });
});
