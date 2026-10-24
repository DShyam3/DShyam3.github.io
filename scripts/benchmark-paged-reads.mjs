#!/usr/bin/env node
// Local synthetic read benchmark. Requires Node 22+, Supabase CLI and seeded local stack.
// Run: node --experimental-strip-types scripts/benchmark-paged-reads.mjs
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import { selectAllPages } from '../src/integrations/supabase/select-all-pages.ts';

let raw;
try {
  raw = execFileSync('supabase', ['status', '-o', 'env'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch {
  throw new Error('Start the seeded local Supabase stack before benchmarking.');
}
const env = new Map(raw.split('\n').map(line => line.match(/^([A-Z_]+)="?(.*?)"?$/))
  .filter(Boolean).map(match => [match[1], match[2]]));
const endpoint = new URL(env.get('API_URL'));
if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
  throw new Error('Benchmark refuses non-loopback Supabase endpoints.');
}
if (!env.get('ANON_KEY') || !env.get('SERVICE_ROLE_KEY')) throw new Error('Local stack keys unavailable.');

let requests = 0;
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => {
    if (new URL(typeof input === 'string' ? input : input.url ?? input).pathname.startsWith('/rest/v1/')) requests++;
    return fetch(input, { ...init, redirect: 'error' });
  } },
};
const admin = createClient(endpoint.href, env.get('SERVICE_ROLE_KEY'), options);
const publicClient = createClient(endpoint.href, env.get('ANON_KEY'), options);
const signedIn = createClient(endpoint.href, env.get('ANON_KEY'), options);
const checked = async (query, label) => {
  const result = await query;
  if (result.error) throw new Error(`${label} failed; inspect the local stack.`);
  return result;
};
if (!process.env.BENCHMARK_PASSWORD) throw new Error('Set BENCHMARK_PASSWORD to the seeded local test account password.');
const { data: login } = await checked(signedIn.auth.signInWithPassword({
  email: 'agent@localhost.test', password: process.env.BENCHMARK_PASSWORD,
}), 'Seeded local login');
const profileId = randomUUID();
const marker = `paged-read-benchmark-${profileId}`;
console.error(`Local fixture marker: ${marker}; profile: ${profileId}`);
const results = [];
let cleanupVerified = false;

const removeFixtures = async () => {
  await checked(admin.from('finance_transactions').delete().eq('profile_id', profileId), 'Transaction cleanup');
  await checked(admin.from('movies').delete().eq('title', marker), 'Movie cleanup');
};
try {
  await checked(admin.from('finance_profiles').insert({
    id: profileId, name: marker, owner_user_id: login.user.id,
  }), 'Fixture profile');
  for (const size of [100, 1000, 5000]) {
    await removeFixtures();
    for (let start = 0; start < size; start += 500) {
      const indices = Array.from({ length: Math.min(500, size - start) }, (_, i) => start + i);
      await checked(admin.from('movies').insert(indices.map(() => ({
        title: marker, platform: 'local benchmark', genre: 'fixture', runtime: 100,
      }))), 'Movie fixtures');
      await checked(admin.from('finance_transactions').insert(indices.map(i => ({
        id: `${profileId}-${i}`, profile_id: profileId, name: 'Synthetic benchmark row',
        date: '2026-01-01', amount: -1, is_default: false,
      }))), 'Transaction fixtures');
    }
    const cases = [
      ['watchlist-movies-anonymous', (from, to) => publicClient.from('movies')
        .select('id, title, platform, genre, release_year, poster, release_date, tmdb_id, runtime', { count: 'exact' })
        .eq('title', marker).order('title').order('id').range(from, to)],
      ['finance-transactions-authenticated', (from, to) => signedIn.from('finance_transactions')
        .select('id, is_default, name, merchant, provider_category, category, amount, date, is_reviewed, account_id, bank_account_id, goal_id, notes, tags, is_recurring', { count: 'exact' })
        .eq('profile_id', profileId).eq('is_default', false).order('date').order('id').range(from, to)],
    ];
    for (const [name, page] of cases) {
      const samples = [];
      for (let run = 0; run < 6; run++) {
        requests = 0;
        const started = performance.now();
        const result = await selectAllPages(page, row => String(row.id));
        const elapsedMs = performance.now() - started;
        if (result.error || result.data.length !== size) throw new Error(`${name}: incomplete fixture read.`);
        if (requests !== Math.ceil(size / 1000)) throw new Error(`${name}: unexpected request count ${requests}.`);
        // First pass warms this fixture/query; remaining five are reported individually.
        if (run > 0) samples.push({ milliseconds: Number(elapsedMs.toFixed(2)), requests });
      }
      results.push({ name, rows: size, samples });
    }
  }
} finally {
  await removeFixtures();
  await checked(admin.from('finance_profiles').delete().eq('id', profileId), 'Profile cleanup');
  for (const [table, column, value] of [
    ['movies', 'title', marker], ['finance_transactions', 'profile_id', profileId],
    ['finance_profiles', 'id', profileId],
  ]) {
    const result = await checked(admin.from(table).select('*', { count: 'exact', head: true }).eq(column, value), 'Cleanup verification');
    if (result.count !== 0) throw new Error('Benchmark fixtures remain in local database.');
  }
  cleanupVerified = true;
}
console.log(JSON.stringify({
  measuredAt: new Date().toISOString(), node: process.version,
  environment: 'local Supabase; synthetic fixtures; one warm-up then five sequential reads',
  scope: 'Real pagination helper and REST requests only; excludes React render, saves, TMDB, TV nesting, and production latency.',
  cleanupVerified, results,
}, null, 2));
