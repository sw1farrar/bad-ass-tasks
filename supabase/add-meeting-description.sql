-- Meeting-level description for agendas and summaries.

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS description TEXT;

NOTIFY pgrst, 'reload schema';
