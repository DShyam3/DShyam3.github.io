/**
 * What the open panel reaches over the network: the model call, through the
 * `assistant` Edge Function, and the reads behind the inventory and release
 * tools. The provider probe is in `useAssistantProvider.ts`, which ships in
 * the entry chunk; this file loads only with the panel.
 *
 * Each read selects named columns, never `*`: what is not read cannot be
 * projected by mistake. Finance is not read here at all -- see
 * `FINANCE_NOT_LOADED` in site-tools.ts.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { INVENTORY_COLUMNS, type InventoryToolRow } from './inventory-tool';
import { unwrapEmbed } from '@/features/watchlist/useWatchlistNews';
import { readsEpisodes, readsMovies, type ReleaseArgs, type ReleaseReadRow } from './releases-tool';

/** Thrown when the model call fails, with a message fit to show. */
export class AssistantRequestError extends Error {
  constructor(message: string, readonly rateLimited: boolean) {
    super(message);
  }
}

/**
 * Sends one request body built by `lib/assistant/protocol` and resolves the
 * provider's raw reply. The function caps and rebuilds the body; this only
 * carries it.
 */
export async function sendAssistantRequest(provider: string, request: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { action: 'chat', provider, request },
  });
  if (error) {
    const status = error instanceof FunctionsHttpError ? (error.context as Response | undefined)?.status : undefined;
    throw new AssistantRequestError(
      status === 429
        ? 'That is a lot of questions in a short time. Try again in a few minutes.'
        : 'The assistant could not answer just now. Try again.',
      status === 429,
    );
  }
  return (data as { reply?: unknown } | null)?.reply;
}

/** Inventory rows, cached briefly so a run of questions reads the table once. */
let inventoryCache: { at: number; rows: InventoryToolRow[] } | null = null;
const INVENTORY_CACHE_MS = 60_000;

export async function readInventoryRows(): Promise<InventoryToolRow[]> {
  if (inventoryCache && Date.now() - inventoryCache.at < INVENTORY_CACHE_MS) return inventoryCache.rows;
  const { data, error } = await selectAllPages((from, to) => supabase
    .from('inventory_items')
    .select(INVENTORY_COLUMNS, { count: 'exact' })
    .order('id', { ascending: true })
    .range(from, to), (row) => String(row.id));
  if (error) throw new Error(error.message);
  const rows = data.map((row): InventoryToolRow => ({
    id: String(row.id),
    name: row.name,
    brand: row.brand,
    category: row.category,
    subcategory: row.subcategory,
    price: row.price === null ? null : Number(row.price),
    specs: row.specs,
    description: row.description,
    is_wishlist: row.is_wishlist,
    is_edc: row.is_edc,
  }));
  inventoryCache = { at: Date.now(), rows };
  return rows;
}

interface ShowEmbed { title: string | null; platform: string | null }
interface SeasonEmbed { season_number: number | null; tv_shows: ShowEmbed | ShowEmbed[] | null }

/**
 * Films and episodes in `args`' range, read with the range as a filter so a
 * year's question reads a year of rows. `getReleases` filters again by the
 * same dates and works out which episodes are premieres; this only bounds the
 * read. The episode embed is the one the Watchlist page reads.
 */
export async function readReleaseRows(args: ReleaseArgs): Promise<ReleaseReadRow[]> {
  const rows: ReleaseReadRow[] = [];

  if (readsMovies(args)) {
    const { data, error } = await selectAllPages((from, to) => supabase
      .from('movies')
      .select('id, title, platform, release_date', { count: 'exact' })
      .gte('release_date', args.from)
      .lte('release_date', args.to)
      .order('id', { ascending: true })
      .range(from, to), (row) => String(row.id));
    if (error) throw new Error(error.message);
    for (const row of data) {
      rows.push({
        kind: 'movie', title: row.title, date: row.release_date, platform: row.platform,
        season: null, episode: null, episodeTitle: null,
      });
    }
  }

  if (readsEpisodes(args)) {
    const { data, error } = await selectAllPages((from, to) => supabase
      .from('tv_show_episodes')
      .select('id, episode_number, title, release_date, tv_show_seasons!inner(season_number, tv_shows!inner(title, platform))', { count: 'exact' })
      .gte('release_date', args.from)
      .lte('release_date', args.to)
      .order('id', { ascending: true })
      .range(from, to), (row) => String(row.id));
    if (error) throw new Error(error.message);
    for (const row of data) {
      const season = unwrapEmbed(row.tv_show_seasons) as SeasonEmbed | undefined;
      const show = unwrapEmbed(season?.tv_shows) as ShowEmbed | undefined;
      rows.push({
        kind: 'episode', title: show?.title ?? 'Unknown show', date: row.release_date, platform: show?.platform ?? null,
        season: season?.season_number ?? null, episode: row.episode_number, episodeTitle: row.title,
      });
    }
  }

  return rows;
}
