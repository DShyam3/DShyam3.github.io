-- The unique scope/date index also covers exact version lookups. Tax timelines
-- are loaded in full (a handful of annual rows), so a second ordering index is
-- redundant and would only add write work.
DROP INDEX public.finance_tax_configs_scope_effective_from_desc_idx;
