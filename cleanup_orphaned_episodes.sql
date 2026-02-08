-- ============================================
-- CLEANUP ORPHANED EPISODES AND SEASONS
-- ============================================

-- Step 1: Count orphaned episodes (episodes whose season doesn't exist)
-- Run this first to see how many orphaned episodes you have
SELECT COUNT(*) as orphaned_episodes_count
FROM tv_show_episodes e
WHERE NOT EXISTS (
    SELECT 1 
    FROM tv_show_seasons s 
    WHERE s.id = e.season_id
);

-- Step 2: View the orphaned episodes (optional - to see what will be deleted)
SELECT e.id, e.episode_number, e.title, e.season_id
FROM tv_show_episodes e
WHERE NOT EXISTS (
    SELECT 1 
    FROM tv_show_seasons s 
    WHERE s.id = e.season_id
)
ORDER BY e.season_id, e.episode_number;

-- Step 3: Count orphaned seasons (seasons whose TV show doesn't exist)
-- Run this to see how many orphaned seasons you have
SELECT COUNT(*) as orphaned_seasons_count
FROM tv_show_seasons s
WHERE NOT EXISTS (
    SELECT 1 
    FROM tv_shows t 
    WHERE t.id = s.tv_show_id
);

-- Step 4: View the orphaned seasons (optional - to see what will be deleted)
SELECT s.id, s.season_number, s.tv_show_id, s.release_date
FROM tv_show_seasons s
WHERE NOT EXISTS (
    SELECT 1 
    FROM tv_shows t 
    WHERE t.id = s.tv_show_id
)
ORDER BY s.tv_show_id, s.season_number;

-- Step 5: DELETE orphaned episodes
-- ⚠️ WARNING: This will permanently delete orphaned episodes
-- Make sure you've reviewed the counts and data above before running this
DELETE FROM tv_show_episodes
WHERE id IN (
    SELECT e.id
    FROM tv_show_episodes e
    WHERE NOT EXISTS (
        SELECT 1 
        FROM tv_show_seasons s 
        WHERE s.id = e.season_id
    )
);

-- Step 6: DELETE orphaned seasons
-- ⚠️ WARNING: This will permanently delete orphaned seasons
-- Make sure you've reviewed the counts and data above before running this
DELETE FROM tv_show_seasons
WHERE id IN (
    SELECT s.id
    FROM tv_show_seasons s
    WHERE NOT EXISTS (
        SELECT 1 
        FROM tv_shows t 
        WHERE t.id = s.tv_show_id
    )
);

-- ============================================
-- SUMMARY QUERY - Run this after cleanup to verify
-- ============================================
SELECT 
    (SELECT COUNT(*) FROM tv_shows) as total_tv_shows,
    (SELECT COUNT(*) FROM tv_show_seasons) as total_seasons,
    (SELECT COUNT(*) FROM tv_show_episodes) as total_episodes,
    (SELECT COUNT(*) FROM tv_show_episodes e WHERE NOT EXISTS (SELECT 1 FROM tv_show_seasons s WHERE s.id = e.season_id)) as remaining_orphaned_episodes,
    (SELECT COUNT(*) FROM tv_show_seasons s WHERE NOT EXISTS (SELECT 1 FROM tv_shows t WHERE t.id = s.tv_show_id)) as remaining_orphaned_seasons;

-- ============================================
-- OPTIONAL: Add foreign key constraints to prevent future orphans
-- ============================================
-- Note: These will automatically cascade deletes in the future
-- Only run these if you want to add database-level constraints

-- Add foreign key constraint to tv_show_seasons
-- ALTER TABLE tv_show_seasons
-- ADD CONSTRAINT fk_tv_show_seasons_tv_show
-- FOREIGN KEY (tv_show_id) 
-- REFERENCES tv_shows(id) 
-- ON DELETE CASCADE;

-- Add foreign key constraint to tv_show_episodes
-- ALTER TABLE tv_show_episodes
-- ADD CONSTRAINT fk_tv_show_episodes_season
-- FOREIGN KEY (season_id) 
-- REFERENCES tv_show_seasons(id) 
-- ON DELETE CASCADE;
