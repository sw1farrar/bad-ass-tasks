"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  KeyRound,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatLocalTimestamp } from "@/lib/datetime";
import {
  activityIconColor,
  categorizeActivityAction,
  createEmptyPlatformAnalytics,
  formatPlatformActivityDetail,
  formatPlatformActivityHeadline,
} from "@/lib/admin/activityAnalytics";
import { formatLoginEventDetail } from "@/lib/auth/loginActivityShared";
import {
  formatLoginEventLabel,
  type PlatformActivityRow,
  type PlatformAnalytics,
  type PlatformLoginEventRow,
  type PlatformStats,
  type PlatformUserRow,
} from "@/lib/admin/platformData";
import {
  AdminActivityMixDonut,
  AdminActivityTrendChart,
  AdminEngagementHero,
  AdminSignupChart,
  AdminVitalsStrip,
} from "./components/AdminPlatformCharts";
import "./site-admin.css";

type AdminTab = "overview" | "users" | "activity" | "logins";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function SiteAdminView() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [users, setUsers] = useState<PlatformUserRow[]>([]);
  const [activity, setActivity] = useState<PlatformActivityRow[]>([]);
  const [loginEvents, setLoginEvents] = useState<PlatformLoginEventRow[]>([]);
  const [search, setSearch] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [statsResult, usersResult, activityResult, loginEventsResult] = await Promise.allSettled([
      adminFetch<{ ok: true; stats: PlatformStats; analytics?: PlatformAnalytics }>("/api/admin/stats"),
      adminFetch<{ ok: true; users: PlatformUserRow[] }>("/api/admin/users"),
      adminFetch<{ ok: true; activity: PlatformActivityRow[] }>("/api/admin/activity?limit=100"),
      adminFetch<{ ok: true; events: PlatformLoginEventRow[] }>("/api/admin/login-activity?limit=200"),
    ]);

    let hadError = false;

    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value.stats);
      setAnalytics(statsResult.value.analytics ?? createEmptyPlatformAnalytics());
    } else {
      hadError = true;
      setStats(null);
      setAnalytics(null);
    }

    if (usersResult.status === "fulfilled") {
      setUsers(usersResult.value.users);
    } else {
      hadError = true;
      setUsers([]);
    }

    if (activityResult.status === "fulfilled") {
      setActivity(activityResult.value.activity);
    } else {
      hadError = true;
      setActivity([]);
    }

    if (loginEventsResult.status === "fulfilled") {
      setLoginEvents(loginEventsResult.value.events);
    } else {
      hadError = true;
      setLoginEvents([]);
    }

    if (hadError) {
      const reason =
        statsResult.status === "rejected"
          ? statsResult.reason
          : usersResult.status === "rejected"
            ? usersResult.reason
            : activityResult.status === "rejected"
              ? activityResult.reason
              : loginEventsResult.status === "rejected"
                ? loginEventsResult.reason
                : null;
      toast.error(reason instanceof Error ? reason.message : "Some admin data failed to load");
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [u.email, u.fullName, u.username, u.id].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [users, search]);

  const handleCreateUser = async () => {
    const email = newEmail.trim();
    const password = newPassword.trim();
    if (!email || password.length < 6) {
      toast.error("Email and password (min 6 chars) are required");
      return;
    }
    setBusyUserId("__create__");
    try {
      await adminFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          fullName: newFullName.trim() || undefined,
        }),
      });
      toast.success(`User created: ${email}`);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setShowAddUser(false);
      await loadAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create user");
    } finally {
      setBusyUserId(null);
    }
  };

  const handlePauseToggle = async (user: PlatformUserRow) => {
    const action = user.accessPaused ? "unpause" : "pause";
    if (
      action === "pause" &&
      !window.confirm(`Pause access for ${user.email ?? user.id}? They will be signed out and unable to log in.`)
    ) {
      return;
    }
    setBusyUserId(user.id);
    try {
      await adminFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: user.id, action }),
      });
      toast.success(action === "pause" ? "User access paused" : "User access restored");
      await loadAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDeleteUser = async (user: PlatformUserRow) => {
    if (
      !window.confirm(
        `Permanently delete ${user.email ?? user.id}? This removes their account, workspaces membership, and data.`
      )
    ) {
      return;
    }
    setBusyUserId(user.id);
    try {
      await adminFetch("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ userId: user.id }),
      });
      toast.success("User deleted");
      await loadAll(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete user");
    } finally {
      setBusyUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="site-admin max-w-6xl mx-auto flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-neon-purple" />
        <p className="text-sm text-text-muted">Loading platform admin…</p>
      </div>
    );
  }

  return (
    <div className="site-admin max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="site-admin-header-icon h-10 w-10 rounded-xl bg-neon-purple/15 border border-neon-purple/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-neon-purple" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Site Admin</h1>
              <p className="text-sm text-text-muted mt-0.5">
                Platform control · users · activity · vitals
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadAll(true)}
          disabled={refreshing}
          className="site-admin-refresh-btn inline-flex items-center gap-2 self-start rounded-xl border px-3.5 py-2 text-xs font-medium text-text-primary transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="site-admin-tabs mb-6">
        {(
          [
            { id: "overview" as const, label: "Overview", icon: BarChart3 },
            { id: "users" as const, label: "Users", icon: Users },
            { id: "activity" as const, label: "Activity", icon: Activity },
            { id: "logins" as const, label: "Logins", icon: KeyRound },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`site-admin-tab inline-flex items-center gap-1.5 ${tab === t.id ? "is-active" : ""}`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && stats && (
        <div className="space-y-5">
          <AdminEngagementHero stats={stats} analytics={analytics ?? createEmptyPlatformAnalytics()} />
          <div className="site-admin-chart-grid">
            <AdminActivityTrendChart analytics={analytics ?? createEmptyPlatformAnalytics()} />
            <AdminActivityMixDonut analytics={analytics ?? createEmptyPlatformAnalytics()} />
            <AdminSignupChart analytics={analytics ?? createEmptyPlatformAnalytics()} />
          </div>
          <AdminVitalsStrip stats={stats} />
          <p className="text-[11px] text-text-faint">
            Snapshot generated {formatLocalTimestamp(stats.generatedAt)} · workspace switches excluded from activity metrics
          </p>
        </div>
      )}

      {tab === "overview" && !stats && !loading && (
        <div className="py-16 text-center text-sm text-text-muted">
          Could not load platform overview. Check admin API configuration and refresh.
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by email, name, username…"
              className="input flex-1 max-w-md rounded-xl px-3.5 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowAddUser((v) => !v)}
              className="site-admin-add-user-btn inline-flex items-center gap-2 rounded-xl border border-neon-purple/40 bg-neon-purple/10 px-4 py-2 text-sm font-medium transition"
            >
              <UserPlus className="h-4 w-4" />
              Add user
            </button>
          </div>

          {showAddUser && (
            <div className="site-admin-form-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email"
                className="input rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Temporary password"
                type="password"
                className="input rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Full name (optional)"
                className="input rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleCreateUser()}
                disabled={busyUserId === "__create__"}
                className="btn btn-primary rounded-lg text-sm py-2 disabled:opacity-50"
              >
                {busyUserId === "__create__" ? "Creating…" : "Create account"}
              </button>
            </div>
          )}

          <div className="site-admin-table-wrap overflow-x-auto">
            <table className="site-admin-table min-w-[880px]">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Workspaces</th>
                  <th>Content</th>
                  <th>Last active</th>
                  <th>Last sign-in</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium text-text-primary">
                        {u.fullName || u.email || "Unnamed"}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {u.email}
                        {u.username ? ` · @${u.username}` : ""}
                      </div>
                    </td>
                    <td>{u.workspaceCount}</td>
                    <td className="text-text-secondary">
                      {u.taskCount} tasks · {u.noteCount} notes
                    </td>
                    <td className="text-text-secondary whitespace-nowrap">
                      {u.lastActiveAt ? formatLocalTimestamp(u.lastActiveAt) : "—"}
                    </td>
                    <td className="text-text-secondary whitespace-nowrap">
                      {u.lastSignInAt ? formatLocalTimestamp(u.lastSignInAt) : "—"}
                    </td>
                    <td>
                      <span
                        className={`site-admin-badge ${u.accessPaused ? "is-paused" : "is-active"}`}
                      >
                        {u.accessPaused ? "Paused" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title={u.accessPaused ? "Restore access" : "Pause access"}
                          disabled={busyUserId === u.id}
                          onClick={() => void handlePauseToggle(u)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-neon-purple hover:bg-surface-hover disabled:opacity-40"
                        >
                          {u.accessPaused ? (
                            <Play className="h-4 w-4" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Delete user"
                          disabled={busyUserId === u.id}
                          onClick={() => void handleDeleteUser(u)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-[var(--priority-p0)] hover:bg-[var(--priority-p0)]/10 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="py-12 text-center text-sm text-text-muted">No users match your search.</div>
            )}
          </div>
        </div>
      )}

      {tab === "logins" && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Authentication audit trail — successful sign-ins, failed attempts, verification prompts, and sign-outs with IP and timestamp.
          </p>
          <div className="site-admin-table-wrap overflow-x-auto">
            <table className="site-admin-table w-full text-sm">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Event</th>
                  <th>Method</th>
                  <th>IP address</th>
                </tr>
              </thead>
              <tbody>
                {loginEvents.map((event) => {
                  const eventDetail = formatLoginEventDetail({
                    id: event.id,
                    eventType: event.eventType,
                    authMethod: event.authMethod,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                    createdAt: event.createdAt,
                    metadata: event.metadata,
                  });
                  return (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap text-text-secondary">
                      {formatLocalTimestamp(event.createdAt)}
                    </td>
                    <td>
                      <div className="font-medium text-text-primary">
                        {event.email ?? event.userName ?? event.userId ?? "Unknown"}
                      </div>
                      {event.userName && event.email ? (
                        <div className="text-xs text-text-muted">{event.userName}</div>
                      ) : null}
                    </td>
                    <td>
                      <div>{formatLoginEventLabel(event.eventType)}</div>
                      {eventDetail ? (
                        <div className="text-xs text-text-muted mt-0.5">{eventDetail}</div>
                      ) : null}
                    </td>
                    <td className="text-text-secondary">{event.authMethod ?? "—"}</td>
                    <td className="font-mono text-xs text-text-secondary">{event.ipAddress ?? "—"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {loginEvents.length === 0 && (
              <div className="py-12 text-center text-sm text-text-muted">
                No login events yet. Run <code className="text-xs">supabase/add-auth-login-events.sql</code> on your
                project if this tab fails to load.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="space-y-5">
          <div className="site-admin-chart-grid">
            <AdminActivityTrendChart analytics={analytics ?? createEmptyPlatformAnalytics()} />
            <AdminActivityMixDonut analytics={analytics ?? createEmptyPlatformAnalytics()} />
          </div>

          <div className="site-admin-table-wrap site-admin-activity-feed">
            {activity.map((item) => {
              const detail = formatPlatformActivityDetail(item);
              const category = categorizeActivityAction(item.actionType);
              const badgeLabel =
                category === "tasks"
                  ? "Task"
                  : category === "notes"
                    ? "Note"
                    : category === "comments"
                      ? "Chat"
                      : category === "collaboration"
                        ? "Team"
                        : "Event";
              return (
                <div key={item.id} className="site-admin-activity-item">
                  <div
                    className="site-admin-activity-icon"
                    style={{ background: activityIconColor(item.actionType) }}
                  >
                    {badgeLabel}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text-primary font-medium">
                      {formatPlatformActivityHeadline(item)}
                    </div>
                    {detail ? (
                      <div className="text-xs text-text-secondary mt-0.5 truncate">{detail}</div>
                    ) : null}
                    <div className="text-[11px] text-text-muted mt-0.5 truncate">
                      {item.workspaceName ?? "Workspace"} · {formatLocalTimestamp(item.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            {activity.length === 0 && (
              <div className="py-12 text-center text-sm text-text-muted">No platform activity yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}