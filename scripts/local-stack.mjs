// Shared setup for the local benchmarks: keys from `supabase status`, a refusal
// to talk to anything but loopback, and clients that count REST requests.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

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

export const counter = { requests: 0 };
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => {
    if (new URL(typeof input === 'string' ? input : input.url ?? input).pathname.startsWith('/rest/v1/')) counter.requests++;
    return fetch(input, { ...init, redirect: 'error' });
  } },
};
export const admin = createClient(endpoint.href, env.get('SERVICE_ROLE_KEY'), options);
export const publicClient = createClient(endpoint.href, env.get('ANON_KEY'), options);
export const signedIn = createClient(endpoint.href, env.get('ANON_KEY'), options);

export const checked = async (query, label) => {
  const result = await query;
  if (result.error) throw new Error(`${label} failed; inspect the local stack.`);
  return result;
};

/** Signs `signedIn` in as the seeded local administrator and returns the user. */
export const signInSeededAdmin = async () => {
  if (!process.env.BENCHMARK_PASSWORD) throw new Error('Set BENCHMARK_PASSWORD to the seeded local test account password.');
  const { data } = await checked(signedIn.auth.signInWithPassword({
    email: 'agent@localhost.test', password: process.env.BENCHMARK_PASSWORD,
  }), 'Seeded local login');
  return data.user;
};

/**
 * Runs every cleanup step even when one fails, so one failed delete does not
 * leave the rest of the fixtures behind, and returns the failures.
 */
export const cleanUp = async (steps) => {
  const failures = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  return failures;
};

/** Throws the run's own error first; cleanup failures are reported alongside. */
export const settle = (failure, cleanupFailures) => {
  if (failure) {
    for (const extra of cleanupFailures) console.error(extra.message);
    throw failure;
  }
  if (cleanupFailures.length > 0) throw cleanupFailures[0];
};

/** Times `run`, returning milliseconds and the REST requests it made. */
export const timed = async (run) => {
  counter.requests = 0;
  const started = performance.now();
  const value = await run();
  return { milliseconds: Number((performance.now() - started).toFixed(2)), requests: counter.requests, value };
};
