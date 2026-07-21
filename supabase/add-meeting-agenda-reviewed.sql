-- Persist reviewed state independently of agenda status so completing/reopening
-- a topic does not lose whether it was reviewed for carry-forward.
ALTER TABLE meeting_agenda_items
  ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT false;

-- Backfill from existing deferred/continued topics
UPDATE meeting_agenda_items
SET reviewed = true
WHERE status = 'continued' AND reviewed = false;

NOTIFY pgrst, 'reload schema';
