import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { logError, logger } from "@/lib/logger";
import type { HealthProfile, HealthReading } from "@/types";
import { generateClientId } from "@/lib/data/hybridStore";

const getClient = () => getSupabaseClient();

function logStoreError(operation: string, error: unknown) {
  logError(`healthStore:${operation}`, error);
  logger.error(`Health operation failed: ${operation}`, error);
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

let healthTablesAvailable: boolean | null = null;

function markMissing(): void {
  healthTablesAvailable = false;
}

function markAvailable(): void {
  healthTablesAvailable = true;
}

export function areHealthTablesReady(): boolean {
  return healthTablesAvailable !== false;
}

export function isHealthPersistenceEnabled(): boolean {
  return healthTablesAvailable === true;
}

export async function ensureHealthPersistenceReady(): Promise<boolean> {
  if (healthTablesAvailable === true) return true;
  const supabase = getClient();
  if (!supabase) {
    markMissing();
    return false;
  }
  try {
    const { error } = await (supabase.from("health_readings") as any).select("id").limit(1);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("probe", error);
      return healthTablesAvailable !== false && healthTablesAvailable !== null;
    }
    markAvailable();
    return true;
  } catch (err) {
    if (isSchemaTableMissing(err)) markMissing();
    else logStoreError("probe", err);
    return false;
  }
}

export interface HealthBundle {
  readings: HealthReading[];
  profiles: HealthProfile[];
}

type ReadingRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProfileRow = {
  workspace_id: string;
  user_id: string;
  height_cm: number | null;
  weight_goal: number | null;
  weight_unit: string | null;
  updated_at: string;
};

function mapReadingRow(row: ReadingRow): HealthReading {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    metricType: row.metric_type as HealthReading["metricType"],
    value: Number(row.value),
    unit: row.unit,
    recordedAt: row.recorded_at,
    note: row.note,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}

function mapProfileRow(row: ProfileRow): HealthProfile {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    heightCm: row.height_cm,
    weightGoal: row.weight_goal,
    weightUnit: row.weight_unit ?? "lb",
    updatedAt: row.updated_at,
  };
}

export async function getHealthBundle(workspaceId: string): Promise<HealthBundle> {
  const empty: HealthBundle = { readings: [], profiles: [] };
  if (!isLiveWorkspace(workspaceId) || !isOnline()) return empty;
  const supabase = getClient();
  if (!supabase) return empty;

  try {
    const [readingsRes, profilesRes] = await Promise.all([
      (supabase.from("health_readings") as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("recorded_at", { ascending: false }),
      (supabase.from("health_profiles") as any)
        .select("*")
        .eq("workspace_id", workspaceId),
    ]);

    const firstError = readingsRes.error ?? profilesRes.error;
    if (firstError) {
      if (isSchemaTableMissing(firstError)) markMissing();
      else logStoreError("getHealthBundle", firstError);
      return empty;
    }
    markAvailable();
    return {
      readings: (readingsRes.data as ReadingRow[] | null)?.map(mapReadingRow) ?? [],
      profiles: (profilesRes.data as ProfileRow[] | null)?.map(mapProfileRow) ?? [],
    };
  } catch (err) {
    logStoreError("getHealthBundle", err);
    return empty;
  }
}

export async function createHealthReading(input: {
  id?: string;
  workspaceId: string;
  userId: string;
  metricType: HealthReading["metricType"];
  value: number;
  unit: string;
  recordedAt?: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload = {
    id: input.id || generateClientId(),
    workspace_id: input.workspaceId,
    user_id: input.userId,
    metric_type: input.metricType,
    value: input.value,
    unit: input.unit,
    recorded_at: input.recordedAt ?? new Date().toISOString(),
    note: input.note ?? null,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  };
  try {
    const { error } = await (supabase.from("health_readings") as any).insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("createHealthReading", error);
      return false;
    }
    return true;
  } catch (err) {
    logStoreError("createHealthReading", err);
    return false;
  }
}

export async function updateHealthReading(
  id: string,
  patch: Partial<Pick<HealthReading, "value" | "unit" | "recordedAt" | "note" | "metadata">>,
): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload: Record<string, unknown> = {};
  if (patch.value !== undefined) payload.value = patch.value;
  if (patch.unit !== undefined) payload.unit = patch.unit;
  if (patch.recordedAt !== undefined) payload.recorded_at = patch.recordedAt;
  if (patch.note !== undefined) payload.note = patch.note;
  if (patch.metadata !== undefined) payload.metadata = patch.metadata;
  try {
    const { error } = await (supabase.from("health_readings") as any).update(payload).eq("id", id);
    if (error) logStoreError("updateHealthReading", error);
    return !error;
  } catch (err) {
    logStoreError("updateHealthReading", err);
    return false;
  }
}

export async function deleteHealthReading(id: string): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from("health_readings") as any).delete().eq("id", id);
    if (error) logStoreError("deleteHealthReading", error);
    return !error;
  } catch (err) {
    logStoreError("deleteHealthReading", err);
    return false;
  }
}

export async function upsertHealthProfile(input: {
  workspaceId: string;
  userId: string;
  heightCm?: number | null;
  weightGoal?: number | null;
  weightUnit?: string;
}): Promise<boolean> {
  if (!isOnline()) return true;
  const supabase = getClient();
  if (!supabase) return false;
  const payload = {
    workspace_id: input.workspaceId,
    user_id: input.userId,
    height_cm: input.heightCm ?? null,
    weight_goal: input.weightGoal ?? null,
    weight_unit: input.weightUnit ?? "lb",
    updated_at: new Date().toISOString(),
  };
  try {
    const { error } = await (supabase.from("health_profiles") as any).upsert(payload, {
      onConflict: "workspace_id,user_id",
    });
    if (error) {
      if (isSchemaTableMissing(error)) markMissing();
      else logStoreError("upsertHealthProfile", error);
      return false;
    }
    return true;
  } catch (err) {
    logStoreError("upsertHealthProfile", err);
    return false;
  }
}