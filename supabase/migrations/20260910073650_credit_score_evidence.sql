-- A credit score is useful on its own, but an archived report gives it a
-- source when the number is revisited years later. The evidence stays in the
-- existing private finance-documents bucket; this optional path is only the
-- pointer to that object, never the report contents.

BEGIN;

ALTER TABLE "public"."finance_credit_scores"
    ADD COLUMN IF NOT EXISTS "storage_path" "text";

COMMENT ON COLUMN "public"."finance_credit_scores"."storage_path" IS
    'Optional path in the private finance-documents bucket to the PDF or image used to record this score. The row remains complete without an archive.';

COMMIT;
