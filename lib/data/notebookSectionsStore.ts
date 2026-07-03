import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { logError, logger } from "@/lib/logger";
import type {
  NotebookCompetitor,
  NotebookCompetitorNote,
  NotebookCustomer,
  NotebookCustomerNote,
  NotebookInvestment,
  NotebookInvestmentNote,
  NotebookTask,
  NotebookTaskProgress,
} from "@/types";
import { generateClientId } from "@/lib/data/hybridStore";

const getClient = () => getSupabaseClient();

function logStoreError(operation: string, error: unknown) {
  logError(`notebookSectionsStore:${operation}`, error);
  logger.error(`Notebook sections operation failed: ${operation}`, error);
}

function isSchemaTableMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  if (e?.code === "42P01" || e?.code === "PGRST205") return true;
  const msg = typeof e?.message === "string" ? e.message.toLowerCase() : "";
  return msg.includes("does not exist") || msg.includes("could not find");
}

function isLiveWorkspace(workspaceId: string): boolean {
  return isSupabaseConfigured() && !!workspaceId && !["", "w1", "w2"].includes(workspaceId);
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

let sectionTablesAvailable: boolean | null = null;

function markMissing(): void {
  sectionTablesAvailable = false;
}

function markAvailable(): void {
  sectionTablesAvailable = true;
}

export function areNotebookSectionTablesReady(): boolean {
  return sectionTablesAvailable !== false;
}

export function isNotebookSectionPersistenceEnabled(): boolean {
  return sectionTablesAvailable === true;
}

export async function ensureNotebookSectionPersistenceReady(): Promise<boolean> {
  if (sectionTablesAvailable === true) return true;
  const supabase = getClient();
  if (!supabase) {
    markMissing();
    return false;
  }
  try {
    const { error } = await (supabase.from("notebook_tasks") as any).select("id").limit(1);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("probe", error);
      return sectionTablesAvailable !== false && sectionTablesAvailable !== null;
    }
    markAvailable();
    return true;
  } catch (err) {
    if (isSchemaTableMissing(err)) markMissing();
    else logStoreError("probe", err);
    return false;
  }
}

export interface NotebookSectionBundle {
  tasks: NotebookTask[];
  taskProgress: NotebookTaskProgress[];
  investments: NotebookInvestment[];
  investmentNotes: NotebookInvestmentNote[];
  customers: NotebookCustomer[];
  customerNotes: NotebookCustomerNote[];
  competitors: NotebookCompetitor[];
  competitorNotes: NotebookCompetitorNote[];
}

type TaskRow = {
  id: string;
  notebook_id: string;
  workspace_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProgressRow = {
  id: string;
  task_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
};

type InvestmentRow = {
  id: string;
  notebook_id: string;
  workspace_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type InvestmentNoteRow = {
  id: string;
  investment_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
};

type CustomerRow = {
  id: string;
  notebook_id: string;
  workspace_id: string;
  account_name: string;
  created_at: string;
  updated_at: string;
};

type CustomerNoteRow = {
  id: string;
  customer_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
};

type CompetitorRow = {
  id: string;
  notebook_id: string;
  workspace_id: string;
  name: string;
  sales_potential: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type CompetitorNoteRow = {
  id: string;
  competitor_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
};

function mapTask(row: TaskRow): NotebookTask {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    workspaceId: row.workspace_id,
    title: row.title,
    completed: row.completed,
    sortOrder: row.sort_order,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProgress(row: ProgressRow): NotebookTaskProgress {
  return {
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

function mapInvestment(row: InvestmentRow): NotebookInvestment {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    workspaceId: row.workspace_id,
    title: row.title,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvestmentNote(row: InvestmentNoteRow): NotebookInvestmentNote {
  return {
    id: row.id,
    investmentId: row.investment_id,
    body: row.body,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

function mapCustomer(row: CustomerRow): NotebookCustomer {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    workspaceId: row.workspace_id,
    accountName: row.account_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCustomerNote(row: CustomerNoteRow): NotebookCustomerNote {
  return {
    id: row.id,
    customerId: row.customer_id,
    body: row.body,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

function mapCompetitor(row: CompetitorRow): NotebookCompetitor {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    workspaceId: row.workspace_id,
    name: row.name,
    salesPotential: Number(row.sales_potential) || 0,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCompetitorNote(row: CompetitorNoteRow): NotebookCompetitorNote {
  return {
    id: row.id,
    competitorId: row.competitor_id,
    body: row.body,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

export async function getNotebookSectionBundle(workspaceId: string): Promise<NotebookSectionBundle> {
  const empty: NotebookSectionBundle = {
    tasks: [],
    taskProgress: [],
    investments: [],
    investmentNotes: [],
    customers: [],
    customerNotes: [],
    competitors: [],
    competitorNotes: [],
  };
  if (!isLiveWorkspace(workspaceId) || !isOnline()) return empty;
  const supabase = getClient();
  if (!supabase) return empty;

  try {
    const [
      tasksRes,
      progressRes,
      investmentsRes,
      investmentNotesRes,
      customersRes,
      notesRes,
      competitorsRes,
      competitorNotesRes,
    ] = await Promise.all([
      (supabase.from("notebook_tasks") as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true }),
      (supabase.from("notebook_task_progress") as any)
        .select("*, notebook_tasks!inner(workspace_id)")
        .eq("notebook_tasks.workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      (supabase.from("notebook_investments") as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true }),
      (supabase.from("notebook_investment_notes") as any)
        .select("*, notebook_investments!inner(workspace_id)")
        .eq("notebook_investments.workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      (supabase.from("notebook_customers") as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("account_name", { ascending: true }),
      (supabase.from("notebook_customer_notes") as any)
        .select("*, notebook_customers!inner(workspace_id)")
        .eq("notebook_customers.workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      (supabase.from("notebook_competitors") as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true }),
      (supabase.from("notebook_competitor_notes") as any)
        .select("*, notebook_competitors!inner(workspace_id)")
        .eq("notebook_competitors.workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
    ]);

    const firstError =
      tasksRes.error ||
      investmentsRes.error ||
      customersRes.error ||
      competitorsRes.error;
    if (firstError) {
      if (isSchemaTableMissing(firstError)) {
        markMissing();
        return empty;
      }
      logStoreError("getNotebookSectionBundle", firstError);
      return empty;
    }

    markAvailable();

    const taskProgress = progressRes.error
      ? []
      : (progressRes.data ?? []).map((row: ProgressRow) => mapProgress(row));

    const investmentNotes = investmentNotesRes.error
      ? []
      : (investmentNotesRes.data ?? []).map((row: InvestmentNoteRow) => mapInvestmentNote(row));

    const customerNotes = notesRes.error
      ? []
      : (notesRes.data ?? []).map((row: CustomerNoteRow) => mapCustomerNote(row));

    const competitorNotes = competitorNotesRes.error
      ? []
      : (competitorNotesRes.data ?? []).map((row: CompetitorNoteRow) => mapCompetitorNote(row));

    return {
      tasks: (tasksRes.data ?? []).map((row: TaskRow) => mapTask(row)),
      taskProgress,
      investments: (investmentsRes.data ?? []).map((row: InvestmentRow) => mapInvestment(row)),
      investmentNotes,
      customers: (customersRes.data ?? []).map((row: CustomerRow) => mapCustomer(row)),
      customerNotes,
      competitors: (competitorsRes.data ?? []).map((row: CompetitorRow) => mapCompetitor(row)),
      competitorNotes,
    };
  } catch (err) {
    logStoreError("getNotebookSectionBundle", err);
    return empty;
  }
}

async function persistOrSkip(workspaceId: string): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId)) return false;
  return ensureNotebookSectionPersistenceReady();
}

export async function createNotebookTask(input: {
  id?: string;
  notebookId: string;
  workspaceId: string;
  title: string;
  sortOrder?: number;
}): Promise<boolean> {
  if (!(await persistOrSkip(input.workspaceId))) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const now = new Date().toISOString();
  const payload = {
    id: input.id || generateClientId(),
    notebook_id: input.notebookId,
    workspace_id: input.workspaceId,
    title: input.title,
    sort_order: input.sortOrder ?? 0,
    created_at: now,
    updated_at: now,
  };
  try {
    const { error } = await (supabase.from("notebook_tasks") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createNotebookTask", error);
      return false;
    }
    markAvailable();
    return true;
  } catch (err) {
    logStoreError("createNotebookTask", err);
    return false;
  }
}

export async function updateNotebookTask(
  id: string,
  workspaceId: string,
  updates: Partial<Pick<NotebookTask, "title" | "completed" | "sortOrder" | "completedAt">>,
): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId) || !isNotebookSectionPersistenceEnabled()) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.completed !== undefined) payload.completed = updates.completed;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;
  if (Object.keys(payload).length === 1) return true;
  try {
    const { error } = await (supabase.from("notebook_tasks") as any)
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) logStoreError("updateNotebookTask", error);
    return true;
  } catch (err) {
    logStoreError("updateNotebookTask", err);
    return true;
  }
}

export async function deleteNotebookTask(id: string, workspaceId: string): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId) || !isNotebookSectionPersistenceEnabled()) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_tasks") as any)
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) logStoreError("deleteNotebookTask", error);
    return true;
  } catch (err) {
    logStoreError("deleteNotebookTask", err);
    return true;
  }
}

export async function createNotebookTaskProgress(input: {
  id?: string;
  taskId: string;
  body: string;
  authorId?: string | null;
}): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload = {
    id: input.id || generateClientId(),
    task_id: input.taskId,
    body: input.body,
    author_id: input.authorId ?? null,
    created_at: new Date().toISOString(),
  };
  try {
    const { error } = await (supabase.from("notebook_task_progress") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createNotebookTaskProgress", error);
      return false;
    }
    return true;
  } catch (err) {
    logStoreError("createNotebookTaskProgress", err);
    return false;
  }
}

export async function updateNotebookTaskProgress(id: string, body: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_task_progress") as any)
      .update({ body })
      .eq("id", id);
    if (error) logStoreError("updateNotebookTaskProgress", error);
    return !error;
  } catch (err) {
    logStoreError("updateNotebookTaskProgress", err);
    return false;
  }
}

export async function deleteNotebookTaskProgress(id: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_task_progress") as any).delete().eq("id", id);
    if (error) logStoreError("deleteNotebookTaskProgress", error);
    return !error;
  } catch (err) {
    logStoreError("deleteNotebookTaskProgress", err);
    return false;
  }
}

export async function createNotebookInvestment(input: {
  id?: string;
  notebookId: string;
  workspaceId: string;
  title: string;
  sortOrder?: number;
}): Promise<boolean> {
  if (!(await persistOrSkip(input.workspaceId))) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const now = new Date().toISOString();
  const payload = {
    id: input.id || generateClientId(),
    notebook_id: input.notebookId,
    workspace_id: input.workspaceId,
    title: input.title,
    sort_order: input.sortOrder ?? 0,
    created_at: now,
    updated_at: now,
  };
  try {
    const { error } = await (supabase.from("notebook_investments") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createNotebookInvestment", error);
      return false;
    }
    markAvailable();
    return true;
  } catch (err) {
    logStoreError("createNotebookInvestment", err);
    return false;
  }
}

export async function updateNotebookInvestment(
  id: string,
  workspaceId: string,
  updates: Partial<Pick<NotebookInvestment, "title" | "sortOrder">>,
): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId) || !isNotebookSectionPersistenceEnabled()) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  if (Object.keys(payload).length === 1) return true;
  try {
    const { error } = await (supabase.from("notebook_investments") as any)
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) logStoreError("updateNotebookInvestment", error);
    return true;
  } catch (err) {
    logStoreError("updateNotebookInvestment", err);
    return true;
  }
}

export async function deleteNotebookInvestment(id: string, workspaceId: string): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId) || !isNotebookSectionPersistenceEnabled()) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_investments") as any)
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) logStoreError("deleteNotebookInvestment", error);
    return true;
  } catch (err) {
    logStoreError("deleteNotebookInvestment", err);
    return true;
  }
}

export async function createNotebookCustomer(input: {
  id?: string;
  notebookId: string;
  workspaceId: string;
  accountName: string;
}): Promise<boolean> {
  if (!(await persistOrSkip(input.workspaceId))) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const now = new Date().toISOString();
  const payload = {
    id: input.id || generateClientId(),
    notebook_id: input.notebookId,
    workspace_id: input.workspaceId,
    account_name: input.accountName,
    created_at: now,
    updated_at: now,
  };
  try {
    const { error } = await (supabase.from("notebook_customers") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createNotebookCustomer", error);
      return false;
    }
    markAvailable();
    return true;
  } catch (err) {
    logStoreError("createNotebookCustomer", err);
    return false;
  }
}

export async function updateNotebookCustomer(
  id: string,
  workspaceId: string,
  updates: Partial<Pick<NotebookCustomer, "accountName">>,
): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId) || !isNotebookSectionPersistenceEnabled()) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.accountName !== undefined) payload.account_name = updates.accountName;
  if (Object.keys(payload).length === 1) return true;
  try {
    const { error } = await (supabase.from("notebook_customers") as any)
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) logStoreError("updateNotebookCustomer", error);
    return true;
  } catch (err) {
    logStoreError("updateNotebookCustomer", err);
    return true;
  }
}

export async function deleteNotebookCustomer(id: string, workspaceId: string): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId) || !isNotebookSectionPersistenceEnabled()) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_customers") as any)
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) logStoreError("deleteNotebookCustomer", error);
    return true;
  } catch (err) {
    logStoreError("deleteNotebookCustomer", err);
    return true;
  }
}

export async function createNotebookInvestmentNote(input: {
  id?: string;
  investmentId: string;
  body: string;
  authorId?: string | null;
}): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload = {
    id: input.id || generateClientId(),
    investment_id: input.investmentId,
    body: input.body,
    author_id: input.authorId ?? null,
    created_at: new Date().toISOString(),
  };
  try {
    const { error } = await (supabase.from("notebook_investment_notes") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createNotebookInvestmentNote", error);
      return false;
    }
    return true;
  } catch (err) {
    logStoreError("createNotebookInvestmentNote", err);
    return false;
  }
}

export async function updateNotebookInvestmentNote(id: string, body: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_investment_notes") as any)
      .update({ body })
      .eq("id", id);
    if (error) logStoreError("updateNotebookInvestmentNote", error);
    return !error;
  } catch (err) {
    logStoreError("updateNotebookInvestmentNote", err);
    return false;
  }
}

export async function deleteNotebookInvestmentNote(id: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_investment_notes") as any).delete().eq("id", id);
    if (error) logStoreError("deleteNotebookInvestmentNote", error);
    return !error;
  } catch (err) {
    logStoreError("deleteNotebookInvestmentNote", err);
    return false;
  }
}

export async function createNotebookCustomerNote(input: {
  id?: string;
  customerId: string;
  body: string;
  authorId?: string | null;
}): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload = {
    id: input.id || generateClientId(),
    customer_id: input.customerId,
    body: input.body,
    author_id: input.authorId ?? null,
    created_at: new Date().toISOString(),
  };
  try {
    const { error } = await (supabase.from("notebook_customer_notes") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createNotebookCustomerNote", error);
      return false;
    }
    return true;
  } catch (err) {
    logStoreError("createNotebookCustomerNote", err);
    return false;
  }
}

export async function updateNotebookCustomerNote(id: string, body: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_customer_notes") as any)
      .update({ body })
      .eq("id", id);
    if (error) logStoreError("updateNotebookCustomerNote", error);
    return !error;
  } catch (err) {
    logStoreError("updateNotebookCustomerNote", err);
    return false;
  }
}

export async function deleteNotebookCustomerNote(id: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_customer_notes") as any).delete().eq("id", id);
    if (error) logStoreError("deleteNotebookCustomerNote", error);
    return !error;
  } catch (err) {
    logStoreError("deleteNotebookCustomerNote", err);
    return false;
  }
}

export async function createNotebookCompetitorNote(input: {
  id?: string;
  competitorId: string;
  body: string;
  authorId?: string | null;
}): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload = {
    id: input.id || generateClientId(),
    competitor_id: input.competitorId,
    body: input.body,
    author_id: input.authorId ?? null,
    created_at: new Date().toISOString(),
  };
  try {
    const { error } = await (supabase.from("notebook_competitor_notes") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createNotebookCompetitorNote", error);
      return false;
    }
    return true;
  } catch (err) {
    logStoreError("createNotebookCompetitorNote", err);
    return false;
  }
}

export async function updateNotebookCompetitorNote(id: string, body: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_competitor_notes") as any)
      .update({ body })
      .eq("id", id);
    if (error) logStoreError("updateNotebookCompetitorNote", error);
    return !error;
  } catch (err) {
    logStoreError("updateNotebookCompetitorNote", err);
    return false;
  }
}

export async function deleteNotebookCompetitorNote(id: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_competitor_notes") as any).delete().eq("id", id);
    if (error) logStoreError("deleteNotebookCompetitorNote", error);
    return !error;
  } catch (err) {
    logStoreError("deleteNotebookCompetitorNote", err);
    return false;
  }
}

export async function createNotebookCompetitor(input: {
  id?: string;
  notebookId: string;
  workspaceId: string;
  name: string;
  salesPotential?: number;
  sortOrder?: number;
}): Promise<boolean> {
  if (!(await persistOrSkip(input.workspaceId))) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const now = new Date().toISOString();
  const payload = {
    id: input.id || generateClientId(),
    notebook_id: input.notebookId,
    workspace_id: input.workspaceId,
    name: input.name,
    sales_potential: input.salesPotential ?? 0,
    sort_order: input.sortOrder ?? 0,
    created_at: now,
    updated_at: now,
  };
  try {
    const { error } = await (supabase.from("notebook_competitors") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createNotebookCompetitor", error);
      return false;
    }
    markAvailable();
    return true;
  } catch (err) {
    logStoreError("createNotebookCompetitor", err);
    return false;
  }
}

export async function updateNotebookCompetitor(
  id: string,
  workspaceId: string,
  updates: Partial<Pick<NotebookCompetitor, "name" | "salesPotential" | "sortOrder">>,
): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId) || !isNotebookSectionPersistenceEnabled()) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.salesPotential !== undefined) payload.sales_potential = updates.salesPotential;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  if (Object.keys(payload).length === 1) return true;
  try {
    const { error } = await (supabase.from("notebook_competitors") as any)
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) logStoreError("updateNotebookCompetitor", error);
    return true;
  } catch (err) {
    logStoreError("updateNotebookCompetitor", err);
    return true;
  }
}

export async function deleteNotebookCompetitor(id: string, workspaceId: string): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId) || !isNotebookSectionPersistenceEnabled()) return true;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebook_competitors") as any)
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) logStoreError("deleteNotebookCompetitor", error);
    return true;
  } catch (err) {
    logStoreError("deleteNotebookCompetitor", err);
    return true;
  }
}

export async function updateNotebookOurSales(
  notebookId: string,
  workspaceId: string,
  ourSales: number,
): Promise<boolean> {
  if (!isLiveWorkspace(workspaceId)) return false;
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("notebooks") as any)
      .update({ our_sales: ourSales, updated_at: new Date().toISOString() })
      .eq("id", notebookId)
      .eq("workspace_id", workspaceId);
    if (error) {
      if (isSchemaTableMissing(error)) return true;
      logStoreError("updateNotebookOurSales", error);
    }
    return true;
  } catch (err) {
    logStoreError("updateNotebookOurSales", err);
    return true;
  }
}