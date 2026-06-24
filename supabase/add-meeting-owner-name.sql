-- Free-text responsible name on agenda topics (in addition to optional owner_id member link)
ALTER TABLE meeting_agenda_items
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

NOTIFY pgrst, 'reload schema';