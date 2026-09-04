/**
 * Download the official streaming-provider logos into public/platform-logos/.
 *
 * Wordmarks come from Wikimedia Commons -- they read far better than an app
 * tile at badge size. Providers without a wordmark on Commons fall back to the
 * square tile TMDB serves for them (the provider's own artwork), which is what
 * the watchlist already uses everywhere else.
 *
 * Run with `node scripts/fetch-platform-logos.mjs` when a provider rebrands;
 * the downloaded files are committed so the site never fetches them at runtime.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'DShyam3-website-logo-fetch/1.0 (https://github.com/DShyam3)';
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/platform-logos');

// Display name -> where its logo comes from. `commons` is a File: title on
// Wikimedia Commons (saved as .svg); `tmdb` is a provider id (saved as .png).
const PLATFORMS = {
  'Netflix': { commons: 'Netflix 2015 logo.svg' },
  // The 2024 file is the app tile (white text knocked out of a blue box); the
  // 2022 wordmark is blue on transparent, which is what a badge wants.
  'Prime Video': { commons: 'Amazon Prime Video logo (2022).svg' },
  'Disney+': { commons: 'Disney+ 2024.svg' },
  'Apple TV+': { commons: 'Apple TV Plus Logo.svg' },
  'BBC iPlayer': { commons: 'BBC iPlayer (2021).svg' },
  'ITVX': { tmdb: 41 },
};

const slug = (name) =>
  name.toLowerCase().replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Commons occasionally answers 503; retry a couple of times before giving up. */
async function get(url, attempt = 1) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (res.status === 503 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return get(url, attempt + 1);
  }
  return res;
}

async function commonsFileUrl(title) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url',
    titles: `File:${title}`,
  });
  const res = await get(`${COMMONS_API}?${params}`);
  if (!res.ok) throw new Error(`Commons lookup for ${title}: ${res.status}`);
  const { query } = await res.json();
  const url = Object.values(query?.pages ?? {})[0]?.imageinfo?.[0]?.url;
  if (!url) throw new Error(`Commons has no file named "${title}"`);
  // The API appends campaign tracking params; upload.wikimedia serves the raw
  // file without them.
  return url.split('?')[0];
}

async function tmdbLogoUrl(providerId) {
  if (!API_KEY) throw new Error('TMDB_API_KEY is not set (put it in .env).');
  for (const type of ['tv', 'movie']) {
    const res = await get(
      `${BASE_URL}/watch/providers/${type}?watch_region=GB&api_key=${API_KEY}`,
    );
    if (!res.ok) throw new Error(`TMDB ${type} providers: ${res.status}`);
    const { results = [] } = await res.json();
    const provider = results.find((p) => p.provider_id === providerId);
    if (provider?.logo_path) return `${TMDB_IMAGE_BASE}${provider.logo_path}`;
  }
  throw new Error(`TMDB has no logo for provider ${providerId}`);
}

await mkdir(OUT_DIR, { recursive: true });

for (const [name, source] of Object.entries(PLATFORMS)) {
  const url = source.commons
    ? await commonsFileUrl(source.commons)
    : await tmdbLogoUrl(source.tmdb);
  const res = await get(url);
  if (!res.ok) throw new Error(`${name} logo: ${res.status}`);
  const file = `${slug(name)}.${source.commons ? 'svg' : 'png'}`;
  await writeFile(resolve(OUT_DIR, file), Buffer.from(await res.arrayBuffer()));
  console.log(`${name} -> ${file}`);
}
