-- Drop upvotes table
DROP TABLE IF EXISTS public.upvotes;

-- Remove 'upvote' from content_type enum if it exists (not easy to remove from enum, so we'll just leave it or leave the table dropped)
-- Actually, let's just drop the table and its policies.
