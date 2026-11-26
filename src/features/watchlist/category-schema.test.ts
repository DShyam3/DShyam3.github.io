import { describe, expect, it } from 'vitest';
import { missingActivityColumn, missingAdditionalFranchisesColumn, missingCategoryColumns } from './category-schema';

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

describe('missingActivityColumn', () => {
  it('recognises the activity column missing before its migration lands', () => {
    expect(missingActivityColumn('column movies.last_activity_at does not exist')).toBe(true);
    expect(missingActivityColumn("Could not find the 'last_activity_at' column of 'tv_shows' in the schema cache")).toBe(true);
  });

  it('does not hide unrelated database errors', () => {
    expect(missingActivityColumn('permission denied for table movies')).toBe(false);
    expect(missingActivityColumn('column movies.genre_ids does not exist')).toBe(false);
  });
});

describe('missingAdditionalFranchisesColumn', () => {
  it('recognises a database or schema-cache rollout gap', () => {
    expect(missingAdditionalFranchisesColumn('column movies.additional_franchises does not exist')).toBe(true);
    expect(missingAdditionalFranchisesColumn("Could not find the 'additional_franchises' column of 'tv_shows' in the schema cache")).toBe(true);
  });

  it('does not hide permission errors', () => {
    expect(missingAdditionalFranchisesColumn('permission denied for additional_franchises')).toBe(false);
  });
});
