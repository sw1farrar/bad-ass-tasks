# Files feature — SQL migrations to run

Run these scripts in the **Supabase SQL Editor** in order. Each file is idempotent (`IF NOT EXISTS` / safe re-run).

## Required (in order)

| Order | Script | Purpose |
|-------|--------|---------|
| 1 | [`supabase/add-workspace-lists.sql`](../supabase/add-workspace-lists.sql) | Lists tables (if not already applied) |
| 2 | [`supabase/add-list-items-nesting.sql`](../supabase/add-list-items-nesting.sql) | List nesting `parent_item_id` |
| 3 | [`supabase/add-note-attachments.sql`](../supabase/add-note-attachments.sql) | Attachment storage metadata |
| 4 | [`supabase/add-note-email-inboxes.sql`](../supabase/add-note-email-inboxes.sql) | Email-in addresses for files |
| 5 | [`supabase/add-email-note-archive.sql`](../supabase/add-email-note-archive.sql) | `search_plain`, `raw_html`, email archive |
| 6 | **`supabase/add-files-review-workflow.sql`** | **Review queue + `search_document` + FTS RPC** |

## Optional (PDF attachment search)

| Order | Script | Purpose |
|-------|--------|---------|
| 7 | [`supabase/add-attachment-extracted-text.sql`](../supabase/add-attachment-extracted-text.sql) | Persist PDF extracted text for durable full-text search |

The app works without script #7 — PDF text is still indexed on upload when possible. Script #7 stores extracted text on the attachment row for re-indexing and search refresh.

## Workspace files-review email (one per workspace)

| Order | Script | Purpose |
|-------|--------|---------|
| 8 | [`supabase/migrate-note-inbox-one-per-workspace.sql`](../supabase/migrate-note-inbox-one-per-workspace.sql) | **One email address per workspace → Review queue** (replaces per-note inboxes) |

Run script #8 if you previously created multiple file inboxes tied to parent notes. It keeps the oldest inbox per workspace and adds a unique constraint on `workspace_id`.

## After running

1. Hard-refresh https://badazztasks.com (or your deployment).
2. Confirm no console warning: *"Files workflow is not synced to Supabase yet"*.
3. New files (manual, upload, email) should land in **Review** until approved.
4. Attachment uploads automatically refresh `search_document` (no extra script).

## Quick checklist

| Step | Script | You ran it? |
|------|--------|-------------|
| Lists | `add-workspace-lists.sql` | if needed |
| List nesting | `add-list-items-nesting.sql` | yes |
| Attachments | `add-note-attachments.sql` | done |
| Email inboxes | `add-note-email-inboxes.sql` | done |
| Email archive | `add-email-note-archive.sql` | done |
| **Files Review + search** | **`add-files-review-workflow.sql`** | done |
| PDF text column (optional) | `add-attachment-extracted-text.sql` | when you want PDF search persistence |
| One workspace review email | `migrate-note-inbox-one-per-workspace.sql` | when upgrading from per-note inboxes |

## What script #6 adds

- `review_status` — `pending_review` | `filed`
- `record_type` — `note` | `email` | `document` | `receipt` | `other`
- `memo`, `filed_at`, `reviewed_by`
- `search_document` — unified search index
- `search_workspace_files()` RPC for server-side search

## Existing data

Script #6 backfills all current notes as **`filed`** (already in your library). Only **new** intake goes to Review after deploy.