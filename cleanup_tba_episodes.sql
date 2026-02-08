-- ============================================
-- CLEANUP TBA EPISODES (Episodes with no release date)
-- ============================================

-- Step 1: Count TBA episodes (episodes with NULL release_date)
SELECT COUNT(*) as tba_episodes_count
FROM tv_show_episodes
WHERE release_date IS NULL;

-- Step 2: View TBA episodes (to see what will be deleted)
SELECT 
    e.id,
    e.episode_number,
    e.title,
    e.season_id,
    s.season_number,
    t.title as show_title
FROM tv_show_episodes e
JOIN tv_show_seasons s ON e.season_id = s.id
JOIN tv_shows t ON s.tv_show_id = t.id
WHERE e.release_date IS NULL
ORDER BY t.title, s.season_number, e.episode_number;

-- Step 3: DELETE TBA episodes
-- ⚠️ WARNING: This will permanently delete all episodes with no release date
DELETE FROM tv_show_episodes
WHERE release_date IS NULL;

-- Step 4: Find and count seasons that now have no episodes
SELECT 
    s.id,
    s.season_number,
    s.tv_show_id,
    t.title as show_title,
    (SELECT COUNT(*) FROM tv_show_episodes WHERE season_id = s.id) as episode_count
FROM tv_show_seasons s
JOIN tv_shows t ON s.tv_show_id = t.id
WHERE (SELECT COUNT(*) FROM tv_show_episodes WHERE season_id = s.id) = 0
ORDER BY t.title, s.season_number;

-- Step 5: DELETE empty seasons (seasons with no episodes)
-- ⚠️ WARNING: This will permanently delete seasons that have no episodes
DELETE FROM tv_show_seasons
WHERE id IN (
    SELECT s.id
    FROM tv_show_seasons s
    WHERE (SELECT COUNT(*) FROM tv_show_episodes WHERE season_id = s.id) = 0
);

-- Step 6: Verification - Check remaining data
SELECT 
    (SELECT COUNT(*) FROM tv_shows) as total_shows,
    (SELECT COUNT(*) FROM tv_show_seasons) as total_seasons,
    (SELECT COUNT(*) FROM tv_show_episodes) as total_episodes,
    (SELECT COUNT(*) FROM tv_show_episodes WHERE release_date IS NULL) as remaining_tba_episodes,
    (SELECT COUNT(*) FROM tv_show_seasons WHERE (SELECT COUNT(*) FROM tv_show_episodes WHERE season_id = tv_show_seasons.id) = 0) as empty_seasons;
