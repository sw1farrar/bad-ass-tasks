import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  buildActivityMix,
  buildEngagementSeries,
  buildSignupSeries,
  isExcludedPlatformActivity,
  type ActivityMixSlice,
  type DailyCountPoint,
  type DailyEngagementPoint,
} from "@/lib/admin/activityAnalytics";

export type PlatformUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  accessPaused: boolean;
  accessPausedAt: string | null;
  workspaceCount: number;
  taskCount: number;
  noteCount: number;
  lastSignInAt: string | null;
};

export type PlatformStats = {
  totalUsers: number;
  activeUsers7d: number;
  pausedUsers: number;
  totalWorkspaces: number;
  totalTasks: number;
  totalNotes: number;
  totalComments: number;
  signupsLast7d: number;
  signupsLast24h: number;
  activityLast24h: number;
  generatedAt: string;
};

export type PlatformActivityRow = {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  actionType: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type PlatformLoginEventRow = {
  id: string;
  userId: string | null;
  email: string | null;
  userName: string | null;
  eventType: string;
  authMethod: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type PlatformAnalytics = {
  activityByDay: DailyEngagementPoint[];
  signupsByDay: DailyCountPoint[];
  activityMix: ActivityMixSlice[];
  engagementRate7d: number;
  contentEvents7d: number;
  avgDailyActiveUsers7d: number;
  peakDay: { label: string; count: number } | null;
  generatedAt: string;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function hoursAgoIso(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

function throwOnSupabaseError(
  res: { error: { message: string } | null },
  label: string,
): void {
  if (res.error) {
    throw new Error(`${label}: ${res.error.message}`);
  }
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const admin = createAdminSupabaseClient();
  const since7d = daysAgoIso(7);
  const since24h = hoursAgoIso(24);

  const [
    profilesRes,
    activeRes,
    pausedRes,
    workspacesRes,
    tasksRes,
    notesRes,
    commentsRes,
    signups7dRes,
    signups24hRes,
    activity24hRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", since7d),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("access_paused", true),
    admin.from("workspaces").select("id", { count: "exact", head: true }),
    admin.from("tasks").select("id", { count: "exact", head: true }),
    admin.from("notes").select("id", { count: "exact", head: true }),
    admin.from("comments").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7d),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since24h),
    admin
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .neq("action_type", "workspace.switched")
      .gte("created_at", since24h),
  ]);

  throwOnSupabaseError(profilesRes, "profiles count");
  throwOnSupabaseError(activeRes, "active users count");
  throwOnSupabaseError(workspacesRes, "workspaces count");
  throwOnSupabaseError(activity24hRes, "activity count");

  return {
    totalUsers: profilesRes.count ?? 0,
    activeUsers7d: activeRes.count ?? 0,
    pausedUsers: pausedRes.count ?? 0,
    totalWorkspaces: workspacesRes.count ?? 0,
    totalTasks: tasksRes.count ?? 0,
    totalNotes: notesRes.count ?? 0,
    totalComments: commentsRes.count ?? 0,
    signupsLast7d: signups7dRes.count ?? 0,
    signupsLast24h: signups24hRes.count ?? 0,
    activityLast24h: activity24hRes.count ?? 0,
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchPlatformUsers(): Promise<PlatformUserRow[]> {
  const admin = createAdminSupabaseClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, username, created_at, last_active_at, access_paused, access_paused_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load profiles");
  }

  const rows = (profiles ?? []) as Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    username: string | null;
    created_at: string | null;
    last_active_at: string | null;
    access_paused?: boolean | null;
    access_paused_at?: string | null;
  }>;

  const authMeta = new Map<string, { lastSignInAt: string | null }>();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (authErr) break;
    const users = authData?.users ?? [];
    users.forEach((u) => {
      authMeta.set(u.id, { lastSignInAt: u.last_sign_in_at ?? null });
    });
    if (users.length < perPage) break;
    page += 1;
  }

  const enriched = await Promise.all(
    rows.map(async (p) => {
      const [wsCount, taskCount, noteCount] = await Promise.all([
        admin
          .from("workspace_members")
          .select("workspace_id", { count: "exact", head: true })
          .eq("user_id", p.id),
        admin
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("created_by", p.id),
        admin
          .from("notes")
          .select("id", { count: "exact", head: true })
          .eq("created_by", p.id),
      ]);

      return {
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        username: p.username,
        createdAt: p.created_at,
        lastActiveAt: p.last_active_at,
        accessPaused: !!p.access_paused,
        accessPausedAt: p.access_paused_at ?? null,
        workspaceCount: wsCount.count ?? 0,
        taskCount: taskCount.count ?? 0,
        noteCount: noteCount.count ?? 0,
        lastSignInAt: authMeta.get(p.id)?.lastSignInAt ?? null,
      } satisfies PlatformUserRow;
    })
  );

  return enriched;
}

export { formatLoginEventLabel } from "@/lib/auth/loginActivityShared";

export async function fetchPlatformLoginActivity(limit = 100): Promise<PlatformLoginEventRow[]> {
  const admin = createAdminSupabaseClient();

  type LoginEventRow = {
    id: string;
    user_id: string | null;
    email: string | null;
    event_type: string;
    auth_method: string | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };

  const { data: eventsRaw, error } = await admin
    .from("auth_login_events")
    .select("id, user_id, email, event_type, auth_method, ip_address, user_agent, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load login activity");
  }

  const events = (eventsRaw ?? []) as LoginEventRow[];
  const userIds = [...new Set(events.map((e) => e.user_id).filter(Boolean))] as string[];

  const profilesRes = userIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };

  const profileMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]),
  );

  return events.map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    userName: row.user_id ? (profileMap.get(row.user_id) ?? null) : null,
    eventType: row.event_type,
    authMethod: row.auth_method,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }));
}

export async function fetchPlatformActivity(limit = 80): Promise<PlatformActivityRow[]> {
  const admin = createAdminSupabaseClient();

  type ActivityLogRow = {
    id: string;
    workspace_id: string;
    user_id: string | null;
    action_type: string;
    target_type: string;
    target_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };

  const { data: logsRaw, error } = await admin
    .from("activity_logs")
    .select("id, workspace_id, user_id, action_type, target_type, target_id, metadata, created_at")
    .neq("action_type", "workspace.switched")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load activity");
  }

  const logs = (logsRaw ?? []) as ActivityLogRow[];
  const workspaceIds = [...new Set(logs.map((l) => l.workspace_id))];
  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];

  const [workspacesRes, profilesRes] = await Promise.all([
    workspaceIds.length
      ? admin.from("workspaces").select("id, name").in("id", workspaceIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin.from("profiles").select("id, email, full_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const wsMap = new Map(
    ((workspacesRes.data ?? []) as Array<{ id: string; name: string }>).map((w) => [w.id, w.name])
  );
  const profileMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>).map(
      (p) => [p.id, p]
    )
  );

  return logs
    .filter((row) => !isExcludedPlatformActivity(row.action_type))
    .map((row) => {
    const profile = row.user_id ? profileMap.get(row.user_id) : undefined;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      workspaceName: wsMap.get(row.workspace_id) ?? null,
      userId: row.user_id,
      userEmail: profile?.email ?? null,
      userName: profile?.full_name ?? null,
      actionType: row.action_type,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    };
  });
}

export async function fetchPlatformAnalytics(): Promise<PlatformAnalytics> {
  const admin = createAdminSupabaseClient();
  const since14d = daysAgoIso(14);
  const since7d = daysAgoIso(7);

  const [logsRes, signupsRes, totalUsersRes, activeUsersRes] = await Promise.all([
    admin
      .from("activity_logs")
      .select("user_id, action_type, created_at")
      .neq("action_type", "workspace.switched")
      .gte("created_at", since14d)
      .order("created_at", { ascending: true }),
    admin
      .from("profiles")
      .select("created_at")
      .gte("created_at", since14d),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", since7d),
  ]);

  const logs = ((logsRes.data ?? []) as Array<{
    user_id: string | null;
    action_type: string;
    created_at: string;
  }>).filter((row) => !isExcludedPlatformActivity(row.action_type));

  const signups = ((signupsRes.data ?? []) as Array<{ created_at: string | null }>);
  const activityByDay = buildEngagementSeries(
    logs.map((row) => ({ createdAt: row.created_at, userId: row.user_id })),
    14,
  );
  const signupsByDay = buildSignupSeries(
    signups.map((row) => ({ createdAt: row.created_at })),
    14,
  );
  const activityMix = buildActivityMix(logs.map((row) => ({ actionType: row.action_type })));

  const last7Days = activityByDay.slice(-7);
  const contentEvents7d = logs.filter((row) => {
    const ts = new Date(row.created_at).getTime();
    return ts >= new Date(since7d).getTime() && ["task.created", "task.completed", "note.created"].includes(row.action_type);
  }).length;

  const avgDailyActiveUsers7d =
    last7Days.reduce((sum, day) => sum + day.uniqueUsers, 0) / Math.max(last7Days.length, 1);

  const totalUsers = totalUsersRes.count ?? 0;
  const activeUsers7d = activeUsersRes.count ?? 0;
  const engagementRate7d = totalUsers > 0 ? Math.round((activeUsers7d / totalUsers) * 100) : 0;

  const peakDay = activityByDay.reduce<{ label: string; count: number } | null>((best, day) => {
    if (!best || day.events > best.count) {
      return { label: day.label, count: day.events };
    }
    return best;
  }, null);

  return {
    activityByDay,
    signupsByDay,
    activityMix,
    engagementRate7d,
    contentEvents7d,
    avgDailyActiveUsers7d: Math.round(avgDailyActiveUsers7d * 10) / 10,
    peakDay,
    generatedAt: new Date().toISOString(),
  };
}

export async function setUserAccessPaused(
  userId: string,
  paused: boolean,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const profileUpdate: Record<string, unknown> = paused
    ? { access_paused: true, access_paused_at: now, access_paused_reason: reason ?? null }
    : { access_paused: false, access_paused_at: null, access_paused_reason: null };

  const { error: profileErr } = await admin
    .from("profiles")
    .update(profileUpdate as never)
    .eq("id", userId);

  if (profileErr) {
    const missingColumn = profileErr.message?.includes("access_paused");
    if (missingColumn) {
      return {
        ok: false,
        error: "Run supabase/add-platform-admin.sql in your Supabase SQL editor first.",
      };
    }
    return { ok: false, error: profileErr.message || "Could not update profile" };
  }

  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: paused ? "876000h" : "none",
  });

  if (banErr) {
    return { ok: false, error: banErr.message || "Could not update auth ban status" };
  }

  return { ok: true };
}

export async function createPlatformUser(input: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const admin = createAdminSupabaseClient();
  const email = input.email.trim().toLowerCase();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.fullName ? { full_name: input.fullName } : undefined,
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message || "Could not create user" };
  }

  await admin.from("profiles").upsert(
    {
      id: data.user.id,
      email,
      full_name: input.fullName?.trim() || null,
    } as never,
    { onConflict: "id" }
  );

  return { ok: true, userId: data.user.id };
}

export async function deletePlatformUser(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false, error: error.message || "Could not delete user" };
  }
  return { ok: true };
}