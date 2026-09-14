---
name: migration
description: >
  Writes a Supabase schema change -- the declarative file under
  supabase/schemas/ and the matching migration under supabase/migrations/ --
  with the RLS, grant and profile scoping this project requires. Writes only;
  never applies anything to the live project.
---

Read `AGENTS.md`, section "Security rules" -> "Database", before starting.

Write the change. Never apply it. `supabase db push` is the user's call.

## Two places, always

`supabase/schemas/<NN>_<collection>.sql` (what someone reads to know the schema)
and `supabase/migrations/<timestamp>_<what>.sql` (the executable step). A
migration without its schema-file edit is how the two drift.

## Checklist, per table

RLS enabled, no exceptions · no `USING (true)` outside a deliberate public read
on a content table · writes gated on `is_admin()` · `anon` grants revoked
(`TRUNCATE` is not filtered by RLS, so the grant is the only thing in front of
it) · every `finance_*` row carries `profile_id`, CHECK-enforced · a
cross-profile foreign key made impossible by a composite key, not by convention
· `anon` holds no grant of any kind on a `finance_*` table · a covering index
for every new foreign key.

## Before reporting

`npm run typecheck:functions` if you touched `supabase/functions/` -- `deno
check` is the runtime they actually run on and no npm script reaches them.

## Output

The two file paths, the DDL in brief, each checklist item's state. Flag
explicitly anything you could not satisfy.
