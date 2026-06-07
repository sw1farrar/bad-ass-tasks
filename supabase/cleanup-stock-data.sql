-- =============================================================================
-- BAD ASS TASKS — Clean stock / demo / template-applied data from Supabase
-- Run in Supabase Dashboard → SQL Editor
--
-- KEEPS: auth.users, profiles, workspaces, workspace_members, workspace_invites
-- REMOVES: tasks, notes, comments, chat, reactions, notifications, activity
--
-- Run each STEP separately; check results before running DELETE steps.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1 — Inventory (read-only)
-- -----------------------------------------------------------------------------
SELECT 'workspaces' AS entity, COUNT(*)::int AS n FROM workspaces
UNION ALL SELECT 'workspace_members', COUNT(*)::int FROM workspace_members
UNION ALL SELECT 'tasks', COUNT(*)::int FROM tasks
UNION ALL SELECT 'notes', COUNT(*)::int FROM notes
UNION ALL SELECT 'comments', COUNT(*)::int FROM comments
UNION ALL SELECT 'workspace_messages', COUNT(*)::int FROM workspace_messages
UNION ALL SELECT 'workspace_message_reactions', COUNT(*)::int FROM workspace_message_reactions
UNION ALL SELECT 'notifications', COUNT(*)::int FROM notifications
UNION ALL SELECT 'activity_logs', COUNT(*)::int FROM activity_logs
ORDER BY entity;

-- Known demo titles (browser-only SAMPLE_* data — if these appear in DB, they're stock)
SELECT id, title, workspace_id, created_at
FROM tasks
WHERE title IN (
  'Ship investor deck v4',
  'Review Q3 financial model with Sarah',
  'Polish landing page copy and hero animation',
  'Schedule user interviews for new onboarding flow',
  'Fix critical billing edge case for annual plans',
  'Write launch announcement thread',
  'Migrate legacy user data to new schema',
  'Weekly team sync & metrics review',
  'Monthly finance close'
)
ORDER BY created_at;

SELECT id, title, workspace_id, created_at
FROM notes
WHERE title IN (
  'Investor Deck Outline — Q1 2026',
  'Landing Page Refresh Notes',
  'Launch Week Plan'
)
ORDER BY created_at;

-- Items created from admin Templates tab (tagged from-template)
SELECT id, title, workspace_id FROM tasks WHERE 'from-template' = ANY(tags);
SELECT id, title, workspace_id FROM notes WHERE 'from-template' = ANY(tags);

-- -----------------------------------------------------------------------------
-- STEP 2A — Surgical delete (demo titles + template-applied only)
-- Safe if you want to keep real tasks you created manually.
-- -----------------------------------------------------------------------------
-- Comments on matching tasks/notes first
DELETE FROM comments
WHERE task_id IN (
  SELECT id FROM tasks
  WHERE title IN (
    'Ship investor deck v4',
    'Review Q3 financial model with Sarah',
    'Polish landing page copy and hero animation',
    'Schedule user interviews for new onboarding flow',
    'Fix critical billing edge case for annual plans',
    'Write launch announcement thread',
    'Migrate legacy user data to new schema',
    'Weekly team sync & metrics review',
    'Monthly finance close'
  )
  OR 'from-template' = ANY(tags)
);

DELETE FROM comments
WHERE note_id IN (
  SELECT id FROM notes
  WHERE title IN (
    'Investor Deck Outline — Q1 2026',
    'Landing Page Refresh Notes',
    'Launch Week Plan'
  )
  OR 'from-template' = ANY(tags)
);

DELETE FROM tasks
WHERE title IN (
  'Ship investor deck v4',
  'Review Q3 financial model with Sarah',
  'Polish landing page copy and hero animation',
  'Schedule user interviews for new onboarding flow',
  'Fix critical billing edge case for annual plans',
  'Write launch announcement thread',
  'Migrate legacy user data to new schema',
  'Weekly team sync & metrics review',
  'Monthly finance close'
)
OR 'from-template' = ANY(tags);

DELETE FROM notes
WHERE title IN (
  'Investor Deck Outline — Q1 2026',
  'Landing Page Refresh Notes',
  'Launch Week Plan'
)
OR 'from-template' = ANY(tags);

-- -----------------------------------------------------------------------------
-- STEP 2B — Full content wipe (recommended for “clean slate”)
-- Removes ALL tasks, notes, chat, comments, notifications, activity.
-- Workspaces and team membership stay intact.
-- SKIP if you only ran 2A and that was enough.
-- -----------------------------------------------------------------------------
DELETE FROM workspace_message_reactions;
DELETE FROM workspace_messages;
DELETE FROM comments;
DELETE FROM notifications;
DELETE FROM activity_logs;
DELETE FROM tasks;
DELETE FROM notes;

-- Optional: clear pending invites (keeps accepted history in members table)
-- DELETE FROM workspace_invites WHERE accepted_at IS NULL;

-- -----------------------------------------------------------------------------
-- STEP 3 — Verify empty
-- -----------------------------------------------------------------------------
SELECT 'tasks' AS entity, COUNT(*)::int AS remaining FROM tasks
UNION ALL SELECT 'notes', COUNT(*)::int FROM notes
UNION ALL SELECT 'workspace_messages', COUNT(*)::int FROM workspace_messages
UNION ALL SELECT 'comments', COUNT(*)::int FROM comments;

NOTIFY pgrst, 'reload schema';