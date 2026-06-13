-- Notification idempotency indexes (prevents duplicate rows for the same event).
-- Run after cleanup: DELETE duplicate rows before applying, or CREATE may fail on conflicts.
-- Safe to re-run: uses IF NOT EXISTS.

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotent_invite
  ON notifications (user_id, ((metadata->>'invite_id')))
  WHERE type = 'invite' AND (metadata->>'invite_id') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotent_deadline
  ON notifications (user_id, ((metadata->>'reminder_key')))
  WHERE type = 'deadline' AND (metadata->>'reminder_key') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotent_comment
  ON notifications (user_id, type, ((metadata->>'comment_id')))
  WHERE (metadata->>'comment_id') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotent_task_assigned
  ON notifications (user_id, ((metadata->>'task_id')))
  WHERE type = 'task_assigned' AND (metadata->>'task_id') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotent_activity_log_col
  ON notifications (user_id, activity_log_id)
  WHERE activity_log_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotent_activity_log_meta
  ON notifications (user_id, type, ((metadata->>'activity_log_id')))
  WHERE (metadata->>'activity_log_id') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotent_activity_note
  ON notifications (user_id, ((metadata->>'note_id')))
  WHERE type = 'activity'
    AND (metadata->>'note_id') IS NOT NULL
    AND activity_log_id IS NULL
    AND (metadata->>'activity_log_id') IS NULL;

COMMENT ON INDEX idx_notifications_idempotent_deadline IS
  'One deadline reminder per user per reminder_key (task + day).';