-- Notebook section features: Tasks, Investments, Customers, Competitors
-- Run in Supabase SQL editor after add-notebooks.sql

-- Optional: our sales figure for market-share comparison (per notebook)
ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS our_sales NUMERIC(18, 2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Tasks (simple checklist + timestamped progress notes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notebook_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_tasks_notebook ON notebook_tasks(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_tasks_workspace ON notebook_tasks(workspace_id);

CREATE TABLE IF NOT EXISTS notebook_task_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES notebook_tasks(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_task_progress_task ON notebook_task_progress(task_id);

-- ---------------------------------------------------------------------------
-- Investments (priority-ordered list)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notebook_investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_investments_notebook ON notebook_investments(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_investments_workspace ON notebook_investments(workspace_id);

CREATE TABLE IF NOT EXISTS notebook_investment_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID NOT NULL REFERENCES notebook_investments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_investment_notes_investment
  ON notebook_investment_notes(investment_id);

-- ---------------------------------------------------------------------------
-- Customers (name + timestamped notes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notebook_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notebook_customers_name_unique
  ON notebook_customers(notebook_id, lower(account_name));

CREATE INDEX IF NOT EXISTS idx_notebook_customers_notebook ON notebook_customers(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_customers_workspace ON notebook_customers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notebook_customers_search
  ON notebook_customers(notebook_id, account_name);

CREATE TABLE IF NOT EXISTS notebook_customer_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES notebook_customers(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_customer_notes_customer ON notebook_customer_notes(customer_id);

-- ---------------------------------------------------------------------------
-- Competitors (sales potential + market share inputs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notebook_competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sales_potential NUMERIC(18, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_competitors_notebook ON notebook_competitors(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_competitors_workspace ON notebook_competitors(workspace_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE notebook_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_investment_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_competitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access notebook_tasks" ON notebook_tasks;
CREATE POLICY "Workspace members can access notebook_tasks" ON notebook_tasks
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access notebook_task_progress" ON notebook_task_progress;
CREATE POLICY "Workspace members can access notebook_task_progress" ON notebook_task_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebook_tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebook_tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace members can access notebook_investments" ON notebook_investments;
CREATE POLICY "Workspace members can access notebook_investments" ON notebook_investments
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access notebook_investment_notes" ON notebook_investment_notes;
CREATE POLICY "Workspace members can access notebook_investment_notes" ON notebook_investment_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebook_investments i
      WHERE i.id = investment_id AND is_workspace_member(i.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebook_investments i
      WHERE i.id = investment_id AND is_workspace_member(i.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace members can access notebook_customers" ON notebook_customers;
CREATE POLICY "Workspace members can access notebook_customers" ON notebook_customers
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access notebook_customer_notes" ON notebook_customer_notes;
CREATE POLICY "Workspace members can access notebook_customer_notes" ON notebook_customer_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebook_customers c
      WHERE c.id = customer_id AND is_workspace_member(c.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notebook_customers c
      WHERE c.id = customer_id AND is_workspace_member(c.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace members can access notebook_competitors" ON notebook_competitors;
CREATE POLICY "Workspace members can access notebook_competitors" ON notebook_competitors
  FOR ALL USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_notebook_tasks_updated_at ON notebook_tasks;
CREATE TRIGGER update_notebook_tasks_updated_at
  BEFORE UPDATE ON notebook_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notebook_investments_updated_at ON notebook_investments;
CREATE TRIGGER update_notebook_investments_updated_at
  BEFORE UPDATE ON notebook_investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notebook_customers_updated_at ON notebook_customers;
CREATE TRIGGER update_notebook_customers_updated_at
  BEFORE UPDATE ON notebook_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notebook_competitors_updated_at ON notebook_competitors;
CREATE TRIGGER update_notebook_competitors_updated_at
  BEFORE UPDATE ON notebook_competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';