import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Route C: the index of logos cached in our own storage.
 *
 * The browser never asks a logo host for anything. The merchant-logo-cache
 * function fetches a mark once, server-side, and puts it in the
 * `merchant-logos` bucket; this reads the index of what landed there and hands
 * back public URLs on our own origin.
 *
 * The index is read rather than the object path guessed, because most
 * merchants in a real ledger have no logo at all -- guessing would mean a 404
 * per unknown merchant, per render, which is both slow and a rather loud way
 * to announce a spending history to the network tab.
 *
 * One shared request: the table is small, public, and identical for everyone,
 * so it is fetched once per page load and every caller waits on the same
 * promise.
 */

type LogoIndex = ReadonlyMap<string, string>;

const EMPTY: LogoIndex = new Map();

let inflight: Promise<LogoIndex> | null = null;

const loadIndex = (): Promise<LogoIndex> => {
  inflight ??= (async () => {
    const { data, error } = await supabase
      .from('finance_merchant_logos')
      .select('slug, storage_path')
      .not('storage_path', 'is', null);

    // A missing index is not an error worth surfacing: every row falls back to
    // its monogram, which is a complete answer on its own.
    if (error || !data) return EMPTY;

    return new Map(
      data.map(row => [
        row.slug,
        supabase.storage.from('merchant-logos').getPublicUrl(row.storage_path!).data.publicUrl,
      ]),
    );
  })();
  return inflight;
};

/** Cached merchant logos by canonical slug. Empty until the index arrives. */
export const useMerchantLogos = (): LogoIndex => {
  const [index, setIndex] = useState<LogoIndex>(EMPTY);

  useEffect(() => {
    let alive = true;
    loadIndex().then(loaded => {
      if (alive) setIndex(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  return index;
};
