// One-off: TMDB facts (genre ids, original language, release year) for
// Discover answers stored without them (20261123135113_watchlist_dismissal_facts).
// Reads the public table's rows that have no facts, asks TMDB per title, and
// writes SQL updates for the owner to apply; this script never writes to a
// database. Safe to run again: the updates only touch rows still without facts.
// node scripts/backfill-dismissal-facts.mjs .env out-dir
import { readFileSync, writeFileSync } from 'node:fs';

const [envPath, outDir] = process.argv.slice(2);
if (!envPath || !outDir) throw new Error('Provide the .env path and an output folder.');
const env = Object.fromEntries(readFileSync(envPath, 'utf8').split('\n')
  .filter((line) => /^[A-Z_]+=/.test(line))
  .map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SUPABASE = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TMDB_KEY = env.TMDB_API_KEY;
if (!SUPABASE || !ANON || !TMDB_KEY) throw new Error('The .env needs VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and TMDB_API_KEY.');

const rows = [];
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(`${SUPABASE}/rest/v1/watchlist_dismissed_suggestions?select=id,media,tmdb_id&genre_ids=is.null&original_language=is.null&release_year=is.null&order=id.asc&offset=${offset}&limit=1000`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) throw new Error(`table read ${res.status}`);
  const page = await res.json();
  rows.push(...page);
  if (page.length < 1000) break;
}

const facts = new Map();
let failed = 0;
let next = 0;
async function worker() {
  while (next < rows.length) {
    const row = rows[next++];
    if (row.media !== 'movie' && row.media !== 'tv') continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`https://api.themoviedb.org/3/${row.media}/${Number(row.tmdb_id)}?api_key=${TMDB_KEY}&language=en-GB`);
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000)); continue; }
      if (res.status === 404) { facts.set(row.id, null); break; }
      if (!res.ok) { failed++; break; }
      const data = await res.json();
      const genreIds = Array.isArray(data.genres) ? data.genres.map((g) => g.id).filter((id) => Number.isInteger(id) && id > 0) : [];
      const language = typeof data.original_language === 'string' && /^[a-z]{2,3}$/.test(data.original_language) ? data.original_language : null;
      const yearText = String(data.release_date || data.first_air_date || '').slice(0, 4);
      const year = /^\d{4}$/.test(yearText) && +yearText >= 1870 && +yearText <= 2100 ? +yearText : null;
      facts.set(row.id, genreIds.length || language || year ? { genreIds, language, year } : null);
      break;
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const values = [...facts].filter(([, f]) => f).map(([id, f]) =>
  `(${Number(id)}, ${f.genreIds.length ? `ARRAY[${f.genreIds.join(',')}]::integer[]` : 'NULL::integer[]'}, ${f.language ? `'${f.language}'` : 'NULL'}, ${f.year ?? 'NULL'}::smallint)`);
const CHUNK = 400;
let files = 0;
for (let i = 0; i < values.length; i += CHUNK) {
  const sql = `UPDATE public.watchlist_dismissed_suggestions AS d
SET genre_ids = v.genre_ids, original_language = v.lang, release_year = v.year
FROM (VALUES
${values.slice(i, i + CHUNK).join(',\n')}
) AS v(id, genre_ids, lang, year)
WHERE d.id = v.id AND d.genre_ids IS NULL AND d.original_language IS NULL AND d.release_year IS NULL;
`;
  writeFileSync(`${outDir}/part-${String(++files).padStart(2, '0')}.sql`, sql);
}
const notFound = [...facts.values()].filter((f) => f === null).length;
console.log(JSON.stringify({ rows: rows.length, withFacts: values.length, notFoundOrEmpty: notFound, failed, files }));
