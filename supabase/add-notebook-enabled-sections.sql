-- Per-notebook section visibility (Notes, Tasks, Investments, Customers, Competitors).
-- Run in Supabase SQL editor after deploying the app update.

ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS enabled_sections JSONB NOT NULL
  DEFAULT '["notes","tasks","investments","customers","competitors"]'::jsonb;

NOTIFY pgrst, 'reload schema';
