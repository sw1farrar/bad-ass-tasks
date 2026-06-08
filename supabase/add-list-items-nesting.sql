-- ============================================
-- List item nesting (parent_item_id)
-- Run in Supabase SQL Editor (idempotent)
-- ============================================

ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES list_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_list_items_list_parent_sort
  ON list_items (list_id, parent_item_id, sort_order ASC);

COMMENT ON COLUMN list_items.parent_item_id IS
  'Optional parent row for nested checklist items. NULL = top-level. sort_order is scoped to siblings (same parent_item_id).';

-- Ensure parent belongs to the same list and workspace
CREATE OR REPLACE FUNCTION validate_list_item_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent list_items%ROWTYPE;
BEGIN
  IF NEW.parent_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_item_id = NEW.id THEN
    RAISE EXCEPTION 'list item cannot be its own parent';
  END IF;

  SELECT * INTO v_parent FROM list_items WHERE id = NEW.parent_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent list item % not found', NEW.parent_item_id;
  END IF;

  IF v_parent.list_id <> NEW.list_id THEN
    RAISE EXCEPTION 'parent list item must belong to the same list';
  END IF;

  IF v_parent.workspace_id <> NEW.workspace_id THEN
    RAISE EXCEPTION 'parent list item must belong to the same workspace';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_list_item_parent_trigger ON list_items;
CREATE TRIGGER validate_list_item_parent_trigger
  BEFORE INSERT OR UPDATE OF parent_item_id, list_id, workspace_id ON list_items
  FOR EACH ROW EXECUTE FUNCTION validate_list_item_parent();

NOTIFY pgrst, 'reload schema';