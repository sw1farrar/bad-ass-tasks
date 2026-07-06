import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type SchemaObjectStatus = {
  name: string;
  kind: "table" | "column" | "function";
  ok: boolean;
  detail?: string;
};

export type DatabaseSchemaReport = {
  connected: boolean;
  configured: boolean;
  ok: boolean;
  checkedAt: string;
  objects: SchemaObjectStatus[];
  missing: string[];
};

const REQUIRED_TABLES = [
  "workspaces",
  "workspace_members",
  "profiles",
  "tasks",
  "notes",
  "comments",
  "workspace_messages",
  "workspace_message_reactions",
  "activity_logs",
  "workspace_invites",
  "notifications",
  "dual_auth_challenges",
  "auth_login_events",
  "workspace_lists",
  "list_items",
  "list_share_invites",
  "workspace_list_shares",
  "notebooks",
  "workspace_receipt_items",
] as const;

const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "notes", column: "linked_note_ids" },
  { table: "notes", column: "sort_order" },
  { table: "notes", column: "snapshots" },
  { table: "notes", column: "ai_suggestion" },
  { table: "notes", column: "notebook_id" },
  { table: "profiles", column: "username" },
  { table: "profiles", column: "location" },
  { table: "profiles", column: "access_paused" },
  { table: "profiles", column: "access_paused_at" },
  { table: "profiles", column: "access_paused_reason" },
];

const REQUIRED_FUNCTIONS = {
  create_workspace_for_user: {
    user_id: "00000000-0000-0000-0000-000000000000",
    workspace_name: "probe",
    workspace_slug: "probe",
  },
  create_workspace_invite: {
    p_workspace_id: "00000000-0000-0000-0000-000000000000",
    p_email: null,
    p_role: "user",
  },
  accept_workspace_invite: {
    p_invite_id: "00000000-0000-0000-0000-000000000000",
  },
  search_users_for_invite: {
    search_term: "probe",
    exclude_workspace_id: null,
  },
  create_list_share_invite: {
    p_list_id: "00000000-0000-0000-0000-000000000000",
    p_invited_user_id: "00000000-0000-0000-0000-000000000000",
    p_recipient_email: null,
  },
  accept_list_share_invite: {
    p_invite_id: "00000000-0000-0000-0000-000000000000",
    p_target_workspace_id: "00000000-0000-0000-0000-000000000000",
  },
  decline_list_share_invite: {
    p_invite_id: "00000000-0000-0000-0000-000000000000",
  },
  get_list_share_linked_workspaces: {
    p_invite_id: "00000000-0000-0000-0000-000000000000",
  },
  get_shared_lists_for_workspace: {
    p_target_workspace_id: "00000000-0000-0000-0000-000000000000",
  },
  share_list_to_workspace: {
    p_list_id: "00000000-0000-0000-0000-000000000000",
    p_target_workspace_id: "00000000-0000-0000-0000-000000000000",
  },
  get_list_share_targets: {
    p_list_id: "00000000-0000-0000-0000-000000000000",
  },
  delete_workspace_for_owner: {
    p_workspace_id: "00000000-0000-0000-0000-000000000000",
  },
  exit_workspace: {
    p_workspace_id: "00000000-0000-0000-0000-000000000000",
  },
  create_dual_auth_challenge_atomic: {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_code_hash: "probe",
    p_expires_at: new Date().toISOString(),
    p_force: false,
  },
} as const;

function isMissingObjectError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("relation") && m.includes("not exist")
  );
}

function isMissingColumnError(message: string | undefined, column: string): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes(column.toLowerCase()) && (m.includes("column") || m.includes("schema cache"));
}

async function probeTable(table: string): Promise<SchemaObjectStatus> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (!error) return { name: table, kind: "table", ok: true };
  if (isMissingObjectError(error.message)) {
    return { name: table, kind: "table", ok: false, detail: error.message };
  }
  // Table exists; other errors (RLS, etc.) still mean the relation is present.
  return { name: table, kind: "table", ok: true, detail: error.message };
}

async function probeColumn(table: string, column: string): Promise<SchemaObjectStatus> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from(table).select(column).limit(0);
  const label = `${table}.${column}`;
  if (!error) return { name: label, kind: "column", ok: true };
  if (isMissingColumnError(error.message, column) || isMissingObjectError(error.message)) {
    return { name: label, kind: "column", ok: false, detail: error.message };
  }
  return { name: label, kind: "column", ok: true, detail: error.message };
}

function isMissingFunctionError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("could not find the function") ||
    (m.includes("function") && m.includes("does not exist"))
  );
}

async function probeFunction(fn: string, args: Record<string, unknown>): Promise<SchemaObjectStatus> {
  const admin = createAdminSupabaseClient();
  const { error } = await (
    admin as unknown as {
      rpc: (
        name: string,
        rpcArgs: Record<string, unknown>,
      ) => Promise<{ error: { message?: string } | null }>;
    }
  ).rpc(fn, args);
  if (!error) return { name: fn, kind: "function", ok: true };
  const msg = error.message ?? "";
  if (isMissingFunctionError(msg)) {
    return { name: fn, kind: "function", ok: false, detail: msg };
  }
  return { name: fn, kind: "function", ok: true, detail: msg };
}

/** Server-only: verify live Supabase schema matches app expectations. */
export async function verifyDatabaseSchema(): Promise<DatabaseSchemaReport> {
  const checkedAt = new Date().toISOString();

  if (!isSupabaseAdminConfigured()) {
    return {
      connected: false,
      configured: false,
      ok: false,
      checkedAt,
      objects: [],
      missing: ["SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL not configured"],
    };
  }

  try {
    const tableResults = await Promise.all(REQUIRED_TABLES.map((t) => probeTable(t)));
    const columnResults = await Promise.all(
      REQUIRED_COLUMNS.map(({ table, column }) => probeColumn(table, column)),
    );
    const functionResults = await Promise.all(
      Object.entries(REQUIRED_FUNCTIONS).map(([fn, args]) => probeFunction(fn, args)),
    );

    const objects = [...tableResults, ...columnResults, ...functionResults];
    const missing = objects.filter((o) => !o.ok).map((o) => `${o.kind}:${o.name}`);

    return {
      connected: true,
      configured: true,
      ok: missing.length === 0,
      checkedAt,
      objects,
      missing,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    return {
      connected: false,
      configured: true,
      ok: false,
      checkedAt,
      objects: [],
      missing: [message],
    };
  }
}