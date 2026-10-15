-- Per-notebook section visibility (Notes and Tasks).
-- Investments, Customers, and Competitors were removed from the app on 2026-10-15.
-- Unknown keys already stored in enabled_sections are ignored by the client.
-- This script does not rewrite existing rows and does not drop columns.

ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS enabled_sections JSONB NOT NULL
  DEFAULT '["notes","tasks"]'::jsonb;

NOTIFY pgrst, 'reload schema';
