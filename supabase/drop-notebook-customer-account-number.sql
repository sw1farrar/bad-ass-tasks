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