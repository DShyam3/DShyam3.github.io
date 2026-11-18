import { describe, expect, it } from 'vitest';
import { missingCategoryColumns } from './category-schema';

describe('missingCategoryColumns', () => {
  it('recognises missing columns during either Postgres or PostgREST rollout', () => {
    expect(missingCategoryColumns('column movies.genre_ids does not exist')).toBe(true);
    expect(missingCategoryColumns("Could not find the 'origin_country' column of 'tv_shows' in the schema cache")).toBe(true);
  });

  it('does not hide unrelated database errors', () => {
    expect(missingCategoryColumns('permission denied for table movies')).toBe(false);
    expect(missingCategoryColumns('column movies.tmdb_id does not exist')).toBe(false);
  });
});
