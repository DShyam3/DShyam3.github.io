#!/usr/bin/env node
// Local synthetic benchmark of finance saves, TV show imports and the nested TV
// library read. Requires Node 22+, Supabase CLI and seeded local stack.
// Run: node --experimental-strip-types scripts/benchmark-saves-and-tv.mjs
import { randomUUID } from 'node:crypto';
import { inChunks } from '../src/features/finance/save-safety.ts';
import { selectAllPages } from '../src/integrations/supabase/select-all-pages.ts';
import {
  admin, checked, cleanUp, publicClient, settle, signedIn, signInSeededAdmin, timed,
} from './local-stack.mjs';

const user = await signInSeededAdmin();
const profileId = randomUUID();
const marker = `saves-tv-benchmark-${profileId}`;
console.error(`Local fixture marker: ${marker}; profile: ${profileId}`);
const results = [];
let cleanupVerified = false;
const RUNS = 6; // first run warms up and is dropped

const record = (name, size, samples, expectRequests) => {
  for (const sample of samples) {
    if (sample.requests !== expectRequests) throw new Error(`${name}: unexpected request count ${sample.requests}.`);
  }
  results.push({ name, size, samples: samples.slice(1).map(({ milliseconds, requests }) => ({ milliseconds, requests })) });
};
const tvCounts = async () => Promise.all(['tv_shows', 'tv_show_seasons', 'tv_show_episodes'].map(async table =>
  (await checked(admin.from(table).select('*', { count: 'exact', head: true }), 'TV count')).count));
const tvBefore = await tvCounts();

const removeTransactions = () =>
  checked(admin.from('finance_transactions').delete().eq('profile_id', profileId), 'Transaction cleanup');
// Seasons and episodes cascade from the show.
const removeShows = () => checked(admin.from('tv_shows').delete().eq('title', marker), 'TV cleanup');
const removeFixtures = async () => {
  await removeTransactions();
  await removeShows();
};

let failure;
try {
  await checked(admin.from('finance_profiles').insert({ id: profileId, name: marker, owner_user_id: user.id }), 'Fixture profile');

  // Finance saves, mirroring saveRows in FinanceDataContext: deletes, updates
  // grouped by identical patch, and inserts, each in sequential chunks of 100.
  for (const size of [100, 1000]) {
    const ids = Array.from({ length: size }, (_, i) => `${profileId}-${i}`);
    const phases = { insert: [], sharedPatch: [], distinctPatches: [], delete: [] };
    for (let run = 0; run < RUNS; run++) {
      await removeFixtures();
      phases.insert.push(await timed(async () => {
        for (const chunk of inChunks(ids, 100)) {
          const { data } = await checked(signedIn.from('finance_transactions').upsert(chunk.map(id => ({
            id, profile_id: profileId, name: 'Synthetic benchmark row', date: '2026-01-01', amount: -1, is_default: false,
          })), { onConflict: 'id', ignoreDuplicates: true }).select('id'), 'Insert');
          if (data.length !== chunk.length) throw new Error('Insert wrote fewer rows than sent.');
        }
      }));
      // One edit applied to every row: a bulk recategorise.
      phases.sharedPatch.push(await timed(async () => {
        for (const chunk of inChunks(ids, 100)) {
          const { data } = await checked(signedIn.from('finance_transactions').update({ category: 'Benchmark' })
            .eq('profile_id', profileId).in('id', chunk).select('id'), 'Shared update');
          if (data.length !== chunk.length) throw new Error('Shared update missed rows.');
        }
      }));
      // A different edit on every row: the worst case, one request per row.
      phases.distinctPatches.push(await timed(async () => {
        for (const [i, id] of ids.entries()) {
          const { data } = await checked(signedIn.from('finance_transactions').update({ amount: -(i + 2) })
            .eq('profile_id', profileId).in('id', [id]).select('id'), 'Distinct update');
          if (data.length !== 1) throw new Error('Distinct update missed a row.');
        }
      }));
      phases.delete.push(await timed(async () => {
        for (const chunk of inChunks(ids, 100)) {
          await checked(signedIn.from('finance_transactions').delete()
            .eq('profile_id', profileId).eq('is_default', false).in('id', chunk), 'Delete');
        }
      }));
    }
    record('finance-save-insert', size, phases.insert, size / 100);
    record('finance-save-update-shared-patch', size, phases.sharedPatch, size / 100);
    record('finance-save-update-distinct-patches', size, phases.distinctPatches, size);
    record('finance-save-delete', size, phases.delete, size / 100);
  }

  // TV import, mirroring addToWatchlist in WatchlistContext without TMDB: the
  // show, then every season in parallel (season row, then its episodes).
  // Removal mirrors removeWatchlistItem.
  for (const [seasons, episodes] of [[1, 10], [5, 10], [20, 25]]) {
    const imports = [];
    const removals = [];
    for (let run = 0; run < RUNS; run++) {
      const imported = await timed(async () => {
        const { data: show } = await checked(signedIn.from('tv_shows').insert({
          title: marker, platform: 'local benchmark', genre: 'fixture', status: 'Returning Series',
        }).select().single(), 'Show insert');
        await Promise.all(Array.from({ length: seasons }, async (_, s) => {
          const { data: season } = await checked(signedIn.from('tv_show_seasons').insert({
            tv_show_id: show.id, season_number: s + 1, release_date: '2026-01-01',
          }).select().single(), 'Season insert');
          await checked(signedIn.from('tv_show_episodes').insert(Array.from({ length: episodes }, (_, e) => ({
            season_id: season.id, episode_number: e + 1, title: 'Synthetic', runtime: 30, release_date: '2026-01-01',
          }))), 'Episode insert');
        }));
        return show.id;
      });
      imports.push(imported);
      removals.push(await timed(async () => {
        const id = imported.value;
        const { data: rows } = await checked(signedIn.from('tv_show_seasons').select('id').eq('tv_show_id', id), 'Season read');
        await checked(signedIn.from('tv_show_episodes').delete().in('season_id', rows.map(row => row.id)), 'Episode delete');
        await checked(signedIn.from('tv_show_seasons').delete().eq('tv_show_id', id), 'Season delete');
        await checked(signedIn.from('tv_shows').delete().eq('id', id), 'Show delete');
      }));
    }
    const shape = `${seasons}x${episodes}`;
    record(`tv-import-${shape}`, seasons * episodes, imports, 1 + 2 * seasons);
    record(`tv-remove-${shape}`, seasons * episodes, removals, 4);
  }

  // Nested library read with the grid's projection, at roughly the hosted
  // library's size (301 shows, 734 seasons, 8,594 episodes on 2026-10-24).
  const { data: shows } = await checked(admin.from('tv_shows').insert(Array.from({ length: 300 }, () => ({
    title: marker, platform: 'local benchmark', genre: 'fixture', status: 'Returning Series',
  }))).select('id'), 'Library shows');
  const { data: seasonRows } = await checked(admin.from('tv_show_seasons').insert(shows.flatMap((show, i) =>
    Array.from({ length: 1 + (i % 4) }, (_, s) => ({ tv_show_id: show.id, season_number: s + 1, release_date: '2026-01-01' })),
  )).select('id'), 'Library seasons');
  const episodeRows = seasonRows.flatMap((season, i) => Array.from({ length: 11 + (i % 2) }, (_, e) => ({
    season_id: season.id, episode_number: e + 1, title: 'Synthetic', runtime: 30, release_date: '2026-01-01',
  })));
  for (const chunk of inChunks(episodeRows, 1000)) {
    await checked(admin.from('tv_show_episodes').insert(chunk), 'Library episodes');
  }
  for (const [name, client] of [['tv-library-read-anonymous', publicClient], ['tv-library-read-authenticated', signedIn]]) {
    const samples = [];
    for (let run = 0; run < RUNS; run++) {
      const sample = await timed(() => selectAllPages((from, to) => client.from('tv_shows')
        .select(`
          id, title, platform, genre, status, poster, release_date, tmdb_id,
          tv_show_seasons (
            id, season_number, release_date, watched,
            tv_show_episodes (id, episode_number, watched, runtime, release_date)
          )
        `, { count: 'exact' })
        .eq('title', marker).order('title').order('id').range(from, to), show => String(show.id)));
      if (sample.value.error || sample.value.data.length !== shows.length) throw new Error(`${name}: incomplete read.`);
      samples.push(sample);
    }
    record(name, episodeRows.length, samples, 1);
  }
} catch (error) {
  failure = error;
}
settle(failure, await cleanUp([
  removeTransactions,
  removeShows,
  () => checked(admin.from('finance_profiles').delete().eq('id', profileId), 'Profile cleanup'),
  async () => {
    for (const [table, column, value] of [
      ['finance_transactions', 'profile_id', profileId], ['finance_profiles', 'id', profileId], ['tv_shows', 'title', marker],
    ]) {
      const result = await checked(admin.from(table).select('*', { count: 'exact', head: true }).eq(column, value), 'Cleanup verification');
      if (result.count !== 0) throw new Error('Benchmark fixtures remain in local database.');
    }
    if ((await tvCounts()).some((count, i) => count !== tvBefore[i])) throw new Error('TV row counts differ from before the run.');
  },
]));
cleanupVerified = true;
console.log(JSON.stringify({
  measuredAt: new Date().toISOString(), node: process.version,
  environment: 'local Supabase; synthetic fixtures; one warm-up then five sequential runs',
  scope: 'Real REST requests in the shapes the app sends; excludes React, TMDB, the library refetch after an import, cron and production latency.',
  cleanupVerified, results,
}, null, 2));
