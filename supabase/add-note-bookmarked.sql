-- Per-user file bookmarks (workspace notes flagged for quick access)
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS bookmarked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN notes.bookmarked IS 'User-flagged file bookmark for quick access in Files browse.';

CREATE INDEX IF NOT EXISTS idx_notes_workspace_bookmarked
  ON notes (workspace_id, bookmarked)
  WHERE bookmarked = true;