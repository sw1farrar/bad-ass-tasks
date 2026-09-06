import type { MappedImportTask, ImportKind } from "@/features/import/types";
import type { Task, TaskStatus, Priority } from "@/types";

export const IMPORT_CHUNK_MAX = 500;

export type ImportChunkRequest = {
  workspaceId: string;
  source: "toodledo";
  kind: ImportKind;
  batchId?: string | null;
  filename?: string | null;
  rows: MappedImportTask[];
};

export type ImportChunkResult = {
  batchId: string;
  inserted: number;
  skipped: number;
  pendingReview: number;
  foldersCreated: number;
  tasks: Task[];
};

type AnyClient = {
  from: (table: string) => any;
};

function isMissingImportSchema(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  return (
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    /import_status|task_import_batches|schema cache/i.test(error.message)
  );
}

export function importSchemaMissingMessage() {
  return "Task import tables are not installed. Run supabase/add-task-import.sql on Supabase.";
}

async function ensureBatch(
  db: AnyClient,
  input: {
    workspaceId: string;
    source: string;
    userId: string;
    batchId?: string | null;
    filename?: string | null;
  },
): Promise<{ id: string; error?: string; schemaMissing?: boolean }> {
  if (input.batchId) {
    const { data, error } = await db
      .from("task_import_batches")
      .select("id")
      .eq("id", input.batchId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (error && isMissingImportSchema(error)) {
      return { id: "", schemaMissing: true, error: importSchemaMissingMessage() };
    }
    if (data?.id) return { id: data.id as string };
  }

  const id = crypto.randomUUID();
  const filenames = input.filename ? [input.filename] : [];
  const { error } = await db.from("task_import_batches").insert({
    id,
    workspace_id: input.workspaceId,
    source: input.source,
    status: "importing",
    filenames,
    created_by: input.userId,
  });
  if (error) {
    if (isMissingImportSchema(error)) {
      return { id: "", schemaMissing: true, error: importSchemaMissingMessage() };
    }
    return { id: "", error: error.message || "Could not create import batch" };
  }
  return { id };
}

async function ensureFolders(
  db: AnyClient,
  workspaceId: string,
  names: string[],
): Promise<{ map: Map<string, string>; created: number; error?: string }> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return { map, created: 0 };

  const { data: existing, error: existingError } = await db
    .from("task_folders")
    .select("id, name")
    .eq("workspace_id", workspaceId);
  if (existingError) {
    return { map, created: 0, error: existingError.message };
  }
  for (const row of existing ?? []) {
    if (row.name) map.set(String(row.name).toLowerCase(), row.id);
  }

  let created = 0;
  let sortOrder = (existing?.length ?? 0) * 1000;
  const missing = unique.filter((name) => !map.has(name.toLowerCase()));
  if (missing.length === 0) return { map, created: 0 };

  const inserts = missing.map((name) => {
    sortOrder += 1000;
    return {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      name,
      sort_order: sortOrder,
    };
  });
  const { data: inserted, error } = await db
    .from("task_folders")
    .insert(inserts)
    .select("id, name");
  if (error) {
    return { map, created: 0, error: error.message };
  }
  for (const row of inserted ?? []) {
    map.set(String(row.name).toLowerCase(), row.id);
    created += 1;
  }
  return { map, created };
}

function toTask(
  row: Record<string, unknown>,
  workspaceId: string,
): Task {
  return {
    id: String(row.id),
    workspaceId,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    status: (row.status as TaskStatus) ?? "todo",
    priority: (row.priority as Priority) ?? "P2",
    dueDate: (row.due_date as string | null) ?? undefined,
    tags: (row.tags as string[]) ?? [],
    createdAt: String(row.created_at ?? new Date().toISOString()),
    completedAt: (row.completed_at as string | null) ?? undefined,
    timeEstimate: (row.time_estimate as number | null) ?? undefined,
    linkedNoteIds: [],
    recurringRule: (row.recurring_rule as string | null) ?? null,
    starred: Boolean(row.starred),
    folderId: (row.folder_id as string | null) ?? null,
    importStatus: (row.import_status as "pending_review" | null) ?? null,
    importBatchId: (row.import_batch_id as string | null) ?? null,
    importSource: (row.import_source as string | null) ?? null,
    importFingerprint: (row.import_fingerprint as string | null) ?? null,
  };
}

export async function runImportChunk(
  db: AnyClient,
  userId: string,
  body: ImportChunkRequest,
): Promise<{ result?: ImportChunkResult; error?: string; status?: number }> {
  if (!body.workspaceId) return { error: "workspaceId is required", status: 400 };
  if (body.source !== "toodledo") return { error: "Unsupported import source", status: 400 };
  if (body.kind !== "current" && body.kind !== "completed") {
    return { error: "kind must be current or completed", status: 400 };
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return { error: "rows are required", status: 400 };
  }
  if (body.rows.length > IMPORT_CHUNK_MAX) {
    return { error: `Max ${IMPORT_CHUNK_MAX} rows per request`, status: 400 };
  }

  const batch = await ensureBatch(db, {
    workspaceId: body.workspaceId,
    source: body.source,
    userId,
    batchId: body.batchId,
    filename: body.filename,
  });
  if (batch.schemaMissing) return { error: batch.error, status: 503 };
  if (!batch.id) return { error: batch.error || "Could not create import batch", status: 500 };

  const folderNames = body.rows
    .map((r) => r.folderName)
    .filter((n): n is string => !!n);
  const folders = await ensureFolders(db, body.workspaceId, folderNames);
  if (folders.error) return { error: folders.error, status: 500 };

  const now = new Date().toISOString();
  const candidates = body.rows.filter((row) => row.title?.trim());
  const fingerprints = candidates.map((row) => row.fingerprint).filter(Boolean);

  const existing = new Set<string>();
  for (let i = 0; i < fingerprints.length; i += 80) {
    const slice = fingerprints.slice(i, i + 80);
    const { data: existingRows, error: existingError } = await db
      .from("tasks")
      .select("import_fingerprint")
      .eq("workspace_id", body.workspaceId)
      .in("import_fingerprint", slice);
    if (existingError) {
      if (isMissingImportSchema(existingError)) {
        return { error: importSchemaMissingMessage(), status: 503 };
      }
      return { error: existingError.message || "Could not check existing import rows", status: 500 };
    }
    for (const row of existingRows ?? []) {
      if (row.import_fingerprint) existing.add(String(row.import_fingerprint));
    }
  }

  const toInsert: MappedImportTask[] = [];
  for (const row of candidates) {
    if (!row.fingerprint || existing.has(row.fingerprint)) continue;
    existing.add(row.fingerprint);
    toInsert.push(row);
  }
  const skipped = candidates.length - toInsert.length;
  const isCurrent = body.kind === "current";

  const payloads = toInsert.map((row) => {
    const folderId = row.folderName
      ? folders.map.get(row.folderName.toLowerCase()) ?? null
      : null;
    return {
      id: crypto.randomUUID(),
      workspace_id: body.workspaceId,
      title: row.title.trim(),
      description: row.description ?? "",
      status: isCurrent ? (row.status === "done" ? "todo" : row.status ?? "todo") : "done",
      priority: row.priority ?? "P2",
      due_date: row.dueDate ?? null,
      completed_at: isCurrent ? null : (row.completedAt ?? now),
      recurring_rule: isCurrent ? row.recurringRule ?? null : null,
      starred: !!row.starred,
      folder_id: folderId,
      tags: row.tags ?? [],
      time_estimate: row.timeEstimate ?? null,
      import_status: isCurrent ? "pending_review" : null,
      import_batch_id: batch.id,
      import_source: body.source,
      import_fingerprint: row.fingerprint,
      created_by: userId,
      created_at: isCurrent ? now : (row.completedAt ?? now),
    };
  });

  let insertedRows: Record<string, unknown>[] = [];
  if (payloads.length > 0) {
    const insert = await db.from("tasks").insert(payloads).select("*");
    if (insert.error) {
      if (isMissingImportSchema(insert.error)) {
        return { error: importSchemaMissingMessage(), status: 503 };
      }
      return { error: insert.error.message || "Import insert failed", status: 500 };
    }
    insertedRows = insert.data ?? [];
  }

  const countField = isCurrent ? "current_count" : "completed_count";
  const { data: batchRow } = await db
    .from("task_import_batches")
    .select("current_count, completed_count, skipped_count")
    .eq("id", batch.id)
    .maybeSingle();
  await db
    .from("task_import_batches")
    .update({
      [countField]: (Number(batchRow?.[countField] ?? 0) || 0) + insertedRows.length,
      skipped_count: (Number(batchRow?.skipped_count ?? 0) || 0) + skipped,
      status:
        isCurrent || Number(batchRow?.current_count ?? 0) + (isCurrent ? insertedRows.length : 0) > 0
          ? "ready"
          : "complete",
    })
    .eq("id", batch.id);

  return {
    result: {
      batchId: batch.id,
      inserted: insertedRows.length,
      skipped,
      pendingReview: isCurrent ? insertedRows.length : 0,
      foldersCreated: folders.created,
      tasks: isCurrent
        ? insertedRows.map((row) => toTask(row, body.workspaceId))
        : [],
    },
  };
}
