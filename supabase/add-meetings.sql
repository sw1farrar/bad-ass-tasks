-- Meetings workspace feature: agendas, timestamped notes, carry-over.
-- Run in Supabase SQL editor after deploying the app update.

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  previous_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  notebook_id UUID REFERENCES notebooks(id) ON DELETE SET NULL,
  attendee_ids UUID[] NOT NULL DEFAULT '{}',
  attendees TEXT[] NOT NULL DEFAULT '{}',
  summary_html TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_workspace ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_meetings_previous ON meetings(previous_meeting_id) WHERE previous_meeting_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  owner_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'continued')),
  reviewed BOOLEAN NOT NULL DEFAULT false,
  continued_from_item_id UUID REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  linked_task_ids UUID[] NOT NULL DEFAULT '{}',
  time_budget_minutes INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_meeting ON meeting_agenda_items(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_agenda_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_item_id UUID NOT NULL REFERENCES meeting_agenda_items(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID,
  is_decision BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_entries_item ON meeting_agenda_entries(agenda_item_id);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agenda_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access meetings" ON meetings;
CREATE POLICY "Workspace members can access meetings" ON meetings
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access meeting agenda items" ON meeting_agenda_items;
CREATE POLICY "Workspace members can access meeting agenda items" ON meeting_agenda_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_agenda_items.meeting_id
        AND is_workspace_member(m.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_agenda_items.meeting_id
        AND is_workspace_member(m.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace members can access meeting agenda entries" ON meeting_agenda_entries;
CREATE POLICY "Workspace members can access meeting agenda entries" ON meeting_agenda_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meeting_agenda_items ai
      JOIN meetings m ON m.id = ai.meeting_id
      WHERE ai.id = meeting_agenda_entries.agenda_item_id
        AND is_workspace_member(m.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meeting_agenda_items ai
      JOIN meetings m ON m.id = ai.meeting_id
      WHERE ai.id = meeting_agenda_entries.agenda_item_id
        AND is_workspace_member(m.workspace_id, auth.uid())
    )
  );

DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_agenda_items_updated_at ON meeting_agenda_items;
CREATE TRIGGER update_meeting_agenda_items_updated_at
  BEFORE UPDATE ON meeting_agenda_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';