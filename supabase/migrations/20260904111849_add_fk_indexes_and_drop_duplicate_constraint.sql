-- Foreign keys without a covering index: every lookup or cascade check on the
-- parent side has to sequential-scan the child table.
CREATE INDEX IF NOT EXISTS idx_finance_budget_items_category_id
  ON public.finance_budget_items (category_id);

CREATE INDEX IF NOT EXISTS idx_finance_goal_contributions_goal_id
  ON public.finance_goal_contributions (goal_id);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_account_id
  ON public.finance_transactions (account_id);

CREATE INDEX IF NOT EXISTS idx_weekly_schedule_movie_id
  ON public.weekly_schedule (movie_id);

-- `episodes_unique_match` and `unique_episode_per_season` are both
-- UNIQUE (season_id, episode_number) constraints on the largest table on the
-- project (~7,600 rows). Keeping both doubles index maintenance on every
-- episode write during a watchlist sync.
--
-- Both the browser sync (WatchlistContext.tsx) and the cron edge function
-- upsert with `onConflict: 'season_id,episode_number'` -- the column-list form,
-- not a constraint name -- so the remaining constraint satisfies it either way.
ALTER TABLE public.tv_show_episodes DROP CONSTRAINT IF EXISTS episodes_unique_match;
