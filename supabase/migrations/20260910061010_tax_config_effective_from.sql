-- Tax-rate configuration is historical reference data. A new budget must add a
-- date-effective version, never overwrite the rates used for an earlier pay
-- period. Existing rows represent the 2026/27 tax year, which began 6 April.
BEGIN;

ALTER TABLE public.finance_tax_configs
  ADD COLUMN effective_from date;

UPDATE public.finance_tax_configs
SET effective_from = DATE '2026-04-06'
WHERE effective_from IS NULL;

ALTER TABLE public.finance_tax_configs
  ALTER COLUMN effective_from SET NOT NULL;

-- Defaults and the admin's overrides are separate timelines. The unique index
-- allows one configuration per scope and effective date, while allowing a
-- future version to be inserted without replacing a past one.
CREATE UNIQUE INDEX finance_tax_configs_scope_effective_from_key
  ON public.finance_tax_configs (is_default, effective_from);

CREATE INDEX finance_tax_configs_scope_effective_from_desc_idx
  ON public.finance_tax_configs (is_default, effective_from DESC);

COMMENT ON COLUMN public.finance_tax_configs.effective_from IS
  'First UK date for which this rate set applies. A new rate set is inserted rather than overwriting prior tax history.';

COMMIT;
