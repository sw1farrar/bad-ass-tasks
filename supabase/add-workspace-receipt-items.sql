-- AI-extracted receipt line items per workspace (deduplicated per file + item)
-- Run in Supabase SQL Editor after add-note-bookmarked.sql

CREATE TABLE IF NOT EXISTS workspace_receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  transaction_date DATE,
  vendor TEXT NOT NULL DEFAULT '',
  item_name TEXT NOT NULL,
  item_category TEXT,
  price_paid NUMERIC(12, 2),
  warranty TEXT,
  return_policy TEXT,
  dedupe_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_receipt_items_dedupe UNIQUE (workspace_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_workspace_date
  ON workspace_receipt_items (workspace_id, transaction_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_receipt_items_workspace_vendor
  ON workspace_receipt_items (workspace_id, vendor);

CREATE INDEX IF NOT EXISTS idx_receipt_items_workspace_category
  ON workspace_receipt_items (workspace_id, item_category);

CREATE INDEX IF NOT EXISTS idx_receipt_items_note
  ON workspace_receipt_items (note_id);

COMMENT ON TABLE workspace_receipt_items IS 'Line items extracted from receipt documents during AI analysis.';
COMMENT ON COLUMN workspace_receipt_items.dedupe_key IS 'Stable hash key: note_id + item + price + date — prevents duplicate logging.';

ALTER TABLE workspace_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access receipt items" ON workspace_receipt_items;
CREATE POLICY "Workspace members can access receipt items" ON workspace_receipt_items
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));