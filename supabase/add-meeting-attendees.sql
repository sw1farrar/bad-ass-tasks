-- Freeform meeting attendee names (not limited to workspace member UUIDs).
-- Run in Supabase SQL editor after deploying the app update.

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS attendees TEXT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
