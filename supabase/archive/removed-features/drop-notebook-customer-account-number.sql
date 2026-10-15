-- SUPERSEDED 2026-10-15. Do not apply.
-- Map, Health, and notebook Investments/Customers/Competitors were removed from the app.
-- Applying this file would recreate objects the application no longer uses.
-- Live tables are intentionally left in place; dropping them is a separate approval.
-- The original statements remain below this guard for a future rollback only.
DO $$
BEGIN
  RAISE EXCEPTION 'superseded script: do not apply. See supabase/archive/removed-features/README.md';
END
$$;

-- Remove account_number from notebook_customers (customers are name-only).
-- Run in Supabase SQL Editor after add-notebook-sections.sql if that migration already ran.

DROP INDEX IF EXISTS idx_notebook_customers_account_unique;
DROP INDEX IF EXISTS idx_notebook_customers_search;

ALTER TABLE notebook_customers DROP CONSTRAINT IF EXISTS notebook_customers_account_number_digits;
ALTER TABLE notebook_customers DROP COLUMN IF EXISTS account_number;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notebook_customers_name_unique
  ON notebook_customers(notebook_id, lower(account_name));

CREATE INDEX IF NOT EXISTS idx_notebook_customers_search
  ON notebook_customers(notebook_id, account_name);

NOTIFY pgrst, 'reload schema';