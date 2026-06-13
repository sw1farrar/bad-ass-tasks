-- Allow inbound_file notifications (files emailed into workspace).
-- Safe to re-run: drops and recreates the type check constraint.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'mention',
    'comment',
    'invite',
    'task_assigned',
    'deadline',
    'activity',
    'inbound_file'
  ));