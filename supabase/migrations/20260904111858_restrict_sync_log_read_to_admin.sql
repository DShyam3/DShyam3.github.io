-- sync_log was anonymously readable, exposing watchlist sync internals
-- (timestamps, item counts, error strings) to any visitor. Nothing on the
-- public site renders it: every consumer in Watchlist.tsx sits behind an
-- `isAdmin` gate (the sync toolbar and the sync history panel), and the
-- daily-sync check in WatchlistContext only runs when autoSyncEnabled.
--
-- fetchSyncLog() still runs on mount for anonymous visitors; RLS filters it to
-- zero rows rather than erroring, so the page behaves the same.
DROP POLICY IF EXISTS "Allow public read access to sync_log" ON public.sync_log;

CREATE POLICY "Admin read sync_log" ON public.sync_log
  FOR SELECT TO authenticated
  USING (public.is_admin());
