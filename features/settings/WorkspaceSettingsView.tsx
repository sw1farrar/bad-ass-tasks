"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Settings,
  BarChart3,
  FileDown,
  Upload,
  FileText,
  Users,
  Download,
  Trash2,
  Bell,
  LogOut,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { useTaskStore } from "@/store/useTaskStore";
import { canDeleteWorkspace } from "@/lib/workspaceGuards";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { formatRoleLabel } from "@/lib/roles";
import type { NotificationType } from "@/types";
import { ConfirmationModal } from "@/components/ConfirmationModal";

type AdminTab = "overview" | "exports" | "imports" | "templates" | "insights";

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  mention: "Mentions",
  comment: "Comments",
  invite: "Workspace invites",
  task_assigned: "Task assignments",
  deadline: "Due date reminders",
  activity: "Workspace activity",
};

const DEFAULT_NOTIFICATION_PREFS = {
  email: true,
  inApp: true,
  types: {
    mention: true,
    comment: true,
    invite: true,
    task_assigned: true,
    deadline: true,
    activity: true,
  },
};

export function WorkspaceSettingsView() {
  const {
    tasks,
    notes,
    members,
    recentActivity,
    currentWorkspace,
    workspaces,
    user,
    updateWorkspaceDetails,
    deleteCurrentWorkspace,
    notificationPrefs,
    updateNotificationPrefs,
    exitWorkspace,
    transferWorkspaceOwnership,
  } = useTaskStore();

  const myRole = currentWorkspace.role;
  const canManage = ["owner", "admin"].includes(myRole);
  const isLiveWorkspace = isSupabaseConfigured() && !["w1", "w2"].includes(currentWorkspace.id);
  const isOwner = myRole === "owner";
  const isTeamMember = !isOwner;

  const workspaceDeleteGuard = useMemo(
    () => canDeleteWorkspace(currentWorkspace.id, workspaces, user?.id),
    [currentWorkspace.id, workspaces, user?.id],
  );

  const [settingsName, setSettingsName] = useState(currentWorkspace.name);
  const [settingsSlug, setSettingsSlug] = useState(currentWorkspace.slug);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [importStrategy, setImportStrategy] = useState<"append" | "skip-dupe-titles">("skip-dupe-titles");
  const [importPreview, setImportPreview] = useState<{ tasks: number; notes: number; source: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [insights, setInsights] = useState<{
    totalActivity: number;
    adminActions?: number;
    topContributors?: [string, number][];
    overdueCount: number;
    overdueByPriority?: Record<string, number>;
    lastAnalyzed: string;
  } | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const prefs = notificationPrefs || DEFAULT_NOTIFICATION_PREFS;

  const transferCandidates = useMemo(
    () => members.filter((m) => m.userId !== user?.id),
    [members, user?.id],
  );

  useEffect(() => {
    setSettingsName(currentWorkspace.name);
    setSettingsSlug(currentWorkspace.slug);
    setDeleteConfirmName("");
    setTransferTargetId("");
  }, [currentWorkspace.id, currentWorkspace.name, currentWorkspace.slug]);

  const handleSaveWorkspaceSettings = async () => {
    if (!isOwner) return;
    setIsSavingSettings(true);
    try {
      const updates: { name?: string; slug?: string } = {};
      if (settingsName.trim() && settingsName.trim() !== currentWorkspace.name) updates.name = settingsName.trim();
      if (settingsSlug.trim() && settingsSlug.trim() !== currentWorkspace.slug) updates.slug = settingsSlug.trim();
      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save");
        return;
      }
      await updateWorkspaceDetails(updates);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!isOwner) return;
    if (!workspaceDeleteGuard.allowed) {
      toast.error(workspaceDeleteGuard.reason ?? "This workspace cannot be deleted");
      return;
    }
    if (deleteConfirmName.trim() !== currentWorkspace.name) {
      toast.error("Type the exact workspace name to confirm deletion");
      return;
    }
    setIsDeletingWorkspace(true);
    try {
      const ok = await deleteCurrentWorkspace();
      if (ok) setDeleteConfirmName("");
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  const handleLeaveWorkspace = async () => {
    const wsId = currentWorkspace?.id;
    if (!wsId) return;
    if (!isLiveWorkspace) {
      toast.info("Leave workspace is a live Supabase feature");
      setPendingLeave(false);
      return;
    }
    setIsLeaving(true);
    try {
      await exitWorkspace(wsId);
      setPendingLeave(false);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTargetId) return;
    setIsTransferring(true);
    try {
      const ok = await transferWorkspaceOwnership(transferTargetId);
      if (ok) {
        setTransferTargetId("");
        setPendingTransfer(false);
      }
    } finally {
      setIsTransferring(false);
    }
  };

  const loadInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const hybrid = await import("@/lib/data/hybridStore");
      const fullActivity = await hybrid.getRecentActivity(currentWorkspace.id, 500);
      const contribMap: Record<string, number> = {};
      fullActivity.forEach((a: { userId?: string; userName?: string }) => {
        const key = a.userId || a.userName || "unknown";
        contribMap[key] = (contribMap[key] || 0) + 1;
      });
      const topContribs = Object.entries(contribMap).sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][];
      const adminActions = fullActivity.filter((a: { actionType?: string }) => (a.actionType || "").startsWith("admin.")).length;
      const overdueNow = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== "done");
      const overdueByPrio: Record<string, number> = {};
      overdueNow.forEach((t) => {
        overdueByPrio[t.priority] = (overdueByPrio[t.priority] || 0) + 1;
      });
      setInsights({
        totalActivity: fullActivity.length,
        adminActions,
        topContributors: topContribs,
        overdueCount: overdueNow.length,
        overdueByPriority: overdueByPrio,
        lastAnalyzed: new Date().toLocaleTimeString(),
      });
      toast.success("Insights loaded");
    } catch {
      const contribMap: Record<string, number> = {};
      recentActivity.forEach((a) => {
        const k = a.userId || "anon";
        contribMap[k] = (contribMap[k] || 0) + 1;
      });
      setInsights({
        totalActivity: recentActivity.length,
        topContributors: Object.entries(contribMap).sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][],
        overdueCount: tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done").length,
        lastAnalyzed: "local (limited)",
      });
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const togglePref = (key: "email" | "inApp", value: boolean) => {
    updateNotificationPrefs({ [key]: value });
  };

  const toggleTypePref = (type: NotificationType, value: boolean) => {
    updateNotificationPrefs({ types: { ...prefs.types, [type]: value } });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2.5">
          <Settings className="h-7 w-7 text-[#c084fc]" />
          Workspace Settings
        </h1>
        <p className="text-sm text-[#71717a] mt-1">
          Manage {currentWorkspace.name} — general settings, notifications, membership, and danger zone.
        </p>
      </div>

      {/* General */}
      <div className="glass rounded-2xl border border-white/10 p-5 space-y-4">
        <div className="font-medium text-sm uppercase tracking-widest text-[#71717a]">General</div>
        <div>
          <label className="text-xs text-[#a1a1aa] block mb-1.5">Name</label>
          <input
            value={settingsName}
            onChange={(e) => setSettingsName(e.target.value)}
            className="input w-full px-4 py-2.5 rounded-xl text-sm"
            disabled={isSavingSettings || !isOwner}
          />
        </div>
        <div>
          <label className="text-xs text-[#a1a1aa] block mb-1.5">Slug (unique URL-friendly ID)</label>
          <input
            value={settingsSlug}
            onChange={(e) => setSettingsSlug(e.target.value)}
            className="input w-full px-4 py-2.5 rounded-xl text-sm font-mono"
            disabled={isSavingSettings || !isOwner}
          />
          <div className="text-[10px] text-[#71717a] mt-1">Changing slug may affect bookmarks and invites.</div>
        </div>
        {isOwner ? (
          <button
            onClick={handleSaveWorkspaceSettings}
            disabled={isSavingSettings}
            className="btn btn-primary text-sm px-5 py-2 disabled:opacity-60"
          >
            {isSavingSettings ? "Saving..." : "Save changes"}
          </button>
        ) : (
          <p className="text-xs text-[#71717a]">Only workspace owners can edit name and slug.</p>
        )}
      </div>

      {/* Notifications — all members */}
      <div className="glass rounded-2xl border border-white/10 p-5 space-y-4">
        <div className="flex items-center gap-2 font-medium text-sm uppercase tracking-widest text-[#71717a]">
          <Bell className="h-4 w-4 text-[#c084fc]" />
          Notifications
        </div>
        <p className="text-xs text-[#71717a]">Choose how you want to be notified for this workspace.</p>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span>In-app notifications</span>
            <input
              type="checkbox"
              checked={prefs.inApp}
              onChange={(e) => togglePref("inApp", e.target.checked)}
              className="h-4 w-4 accent-[#c084fc]"
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span>Email notifications</span>
            <input
              type="checkbox"
              checked={prefs.email}
              onChange={(e) => togglePref("email", e.target.checked)}
              className="h-4 w-4 accent-[#c084fc]"
            />
          </label>
        </div>

        <div className="pt-1 space-y-2">
          <div className="text-xs text-[#a1a1aa] uppercase tracking-widest">Notification types</div>
          {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((type) => (
            <label
              key={type}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 px-4 py-2.5 text-sm"
            >
              <span className="text-[#e5e5e7]">{NOTIFICATION_TYPE_LABELS[type]}</span>
              <input
                type="checkbox"
                checked={prefs.types?.[type] ?? true}
                onChange={(e) => toggleTypePref(type, e.target.checked)}
                className="h-4 w-4 accent-[#c084fc]"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Transfer ownership — owner only */}
      {isOwner && isLiveWorkspace && (
        <div className="glass rounded-2xl border border-[#c084fc]/25 p-5 space-y-4">
          <div className="flex items-center gap-2 font-medium text-sm uppercase tracking-widest text-[#c084fc]">
            <Crown className="h-4 w-4" />
            Transfer ownership
          </div>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            Hand off this workspace to another member. You will become an admin after the transfer.
          </p>
          {transferCandidates.length === 0 ? (
            <p className="text-xs text-[#71717a]">Invite at least one other member before you can transfer ownership.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                className="flex-1 bg-[#111114] border border-white/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#c084fc]"
              >
                <option value="">Select a member…</option>
                {transferCandidates.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName || (m.username ? `@${m.username}` : "Member")} ({formatRoleLabel(m.role)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => transferTargetId && setPendingTransfer(true)}
                disabled={!transferTargetId || isTransferring}
                className="btn btn-secondary text-sm px-5 py-2.5 disabled:opacity-50 whitespace-nowrap"
              >
                Transfer ownership
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leave workspace — non-owners */}
      {isTeamMember && (
        <div className="glass rounded-2xl border border-white/10 p-5 space-y-3">
          <div className="flex items-center gap-2 font-medium text-sm uppercase tracking-widest text-[#71717a]">
            <LogOut className="h-4 w-4" />
            Membership
          </div>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            Leave this workspace if you no longer need access. Your role:{" "}
            <span className="font-mono text-[#c084fc]">{formatRoleLabel(myRole)}</span>.
          </p>
          <button
            type="button"
            onClick={() => setPendingLeave(true)}
            disabled={!isLiveWorkspace || isLeaving}
            className="btn btn-secondary text-sm px-5 py-2 border border-white/20"
          >
            {isLeaving ? "Leaving…" : "Leave workspace"}
          </button>
        </div>
      )}

      {/* Admin tools */}
      {canManage && (
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/5">
            <div className="font-semibold text-sm mb-3">Data &amp; admin tools</div>
            <div className="flex gap-1 text-xs overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory touch-pan-x">
              {(
                [
                  { id: "overview" as const, label: "Overview", icon: BarChart3 },
                  { id: "exports" as const, label: "Export", icon: FileDown },
                  { id: "imports" as const, label: "Import", icon: Upload },
                  { id: "templates" as const, label: "Templates", icon: FileText },
                  { id: "insights" as const, label: "Insights", icon: Users },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = adminTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAdminTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] snap-start rounded-xl border transition-all shrink-0 ${
                      active
                        ? "bg-[#c084fc] text-black border-[#c084fc] font-medium"
                        : "bg-white/5 border-white/10 hover:bg-white/10 text-[#a1a1aa] hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {adminTab === "overview" && (
            <div className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-[#71717a] text-xs">Tasks / Done</div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">
                    {tasks.length}{" "}
                    <span className="text-xs text-[#a1a1aa]">/ {tasks.filter((t) => t.status === "done").length}</span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-[#71717a] text-xs">Notes / Team</div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">
                    {notes.length} <span className="text-xs text-[#a1a1aa]">/ {members.length}</span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-[#71717a] text-xs">Overdue</div>
                  <div className="text-2xl font-semibold tabular-nums mt-1 text-[#ff3366]">
                    {tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== "done").length}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-[#71717a] text-xs">Activity</div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">{recentActivity.length}</div>
                </div>
              </div>
            </div>
          )}

          {adminTab === "exports" && (
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => useTaskStore.getState().exportWorkspace("json")}
                  disabled={!isLiveWorkspace}
                  className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" /> JSON
                </button>
                <button
                  type="button"
                  onClick={() => useTaskStore.getState().exportWorkspace("csv")}
                  disabled={!isLiveWorkspace}
                  className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" /> CSV
                </button>
                <button
                  type="button"
                  onClick={() => useTaskStore.getState().exportWorkspace("md")}
                  disabled={!isLiveWorkspace}
                  className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" /> Markdown
                </button>
                <button
                  type="button"
                  onClick={() => useTaskStore.getState().exportWorkspace("all")}
                  disabled={!isLiveWorkspace}
                  className="btn btn-primary text-xs px-4 py-2 flex items-center gap-2 bg-[#c084fc] text-black hover:bg-[#a855f7]"
                >
                  <Download className="h-4 w-4" /> All
                </button>
              </div>
            </div>
          )}

          {adminTab === "imports" && (
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex gap-2 text-xs">
                  <label
                    className={`px-3 py-1 rounded-xl border cursor-pointer ${
                      importStrategy === "skip-dupe-titles" ? "border-[#c084fc] bg-white/10" : "border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      className="hidden"
                      checked={importStrategy === "skip-dupe-titles"}
                      onChange={() => setImportStrategy("skip-dupe-titles")}
                    />{" "}
                    Skip duplicates
                  </label>
                  <label
                    className={`px-3 py-1 rounded-xl border cursor-pointer ${
                      importStrategy === "append" ? "border-[#c084fc] bg-white/10" : "border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      className="hidden"
                      checked={importStrategy === "append"}
                      onChange={() => setImportStrategy("append")}
                    />{" "}
                    Append all
                  </label>
                </div>
                <label className="btn btn-secondary text-xs px-4 py-2 cursor-pointer inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Choose file
                  <input
                    type="file"
                    accept=".json,.csv,.md,.txt"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !isLiveWorkspace) return;
                      setImportPreview(null);
                      const text = await file.text();
                      const ext = file.name.split(".").pop()?.toLowerCase() || "";
                      let parsed: { tasks?: unknown[]; notes?: unknown[] } = { tasks: [], notes: [] };
                      try {
                        const utilsMod = await import("@/lib/utils");
                        if (ext === "json") {
                          parsed = utilsMod.parseJSONImport(text);
                        } else if (ext === "csv") {
                          parsed = { tasks: utilsMod.parseCSVToTasks(text) };
                        } else {
                          const taskLines = text.split("\n").filter((l) => l.match(/^\s*-\s*\[[\sx]\]/i));
                          parsed.tasks = taskLines.map((l) => ({
                            title: l.replace(/^\s*-\s*\[[\sx]\]\s*/, "").trim().slice(0, 140),
                          }));
                          const noteMatches = text.match(/^###\s+(.+)$/gm) || [];
                          parsed.notes = noteMatches.slice(0, 20).map((h) => ({
                            title: h.replace(/^###\s+/, "").trim(),
                          }));
                        }
                        setImportPreview({
                          tasks: parsed.tasks?.length || 0,
                          notes: parsed.notes?.length || 0,
                          source: file.name,
                        });
                        (window as unknown as { __pendingImport?: unknown }).__pendingImport = parsed;
                      } catch {
                        toast.error("Failed to parse file");
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {importPreview && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs">
                  <div>
                    Preview from <span className="font-mono">{importPreview.source}</span>:
                  </div>
                  <div className="font-medium mt-1">
                    {importPreview.tasks} tasks • {importPreview.notes} notes ready to import.
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={isImporting || !isLiveWorkspace}
                      onClick={async () => {
                        const parsed = (window as unknown as { __pendingImport?: { tasks?: unknown[]; notes?: unknown[] } })
                          .__pendingImport;
                        if (!parsed) return;
                        setIsImporting(true);
                        try {
                          const res = await useTaskStore.getState().importWorkspaceData(parsed, {
                            conflictStrategy: importStrategy,
                          });
                          toast.success(
                            `Import complete: ${res.importedTasks} tasks, ${res.importedNotes} notes${
                              res.skippedTasks || res.skippedNotes
                                ? ` (skipped ${res.skippedTasks || 0} tasks, ${res.skippedNotes || 0} notes)`
                                : ""
                            }`,
                          );
                          await useTaskStore.getState().initializeFromSupabase?.();
                          setImportPreview(null);
                          (window as unknown as { __pendingImport?: unknown }).__pendingImport = null;
                        } catch {
                          toast.error("Import failed");
                        } finally {
                          setIsImporting(false);
                        }
                      }}
                      className="btn btn-primary text-xs px-3 py-1"
                    >
                      {isImporting ? "Importing..." : `Import with ${importStrategy === "skip-dupe-titles" ? "Smart Skip" : "Append"}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportPreview(null);
                        (window as unknown as { __pendingImport?: unknown }).__pendingImport = null;
                      }}
                      className="btn btn-ghost text-xs px-3 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {adminTab === "templates" && (
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {(useTaskStore.getState().getAdminTemplateLibrary?.() ?? []).map(
                  (tpl: { title: string; type: string; description?: string; tags?: string[] }, idx: number) => (
                    <div
                      key={idx}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-[#c084fc]/40 transition group"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {tpl.title}
                            <span
                              className={`text-[9px] px-1 rounded ${
                                tpl.type === "note" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {tpl.type}
                            </span>
                          </div>
                          {tpl.description && (
                            <div className="text-[10px] text-[#a1a1aa] line-clamp-2 mt-0.5 pr-2">
                              {tpl.description.slice(0, 110)}
                              {tpl.description.length > 110 ? "…" : ""}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await useTaskStore.getState().applyTemplate(tpl);
                            if (res) toast.success(`Applied: ${tpl.title}`);
                            else toast.info("Template applied (demo or error — check tasks/notes)");
                          }}
                          className="opacity-70 group-hover:opacity-100 text-[#c084fc] hover:text-white text-[10px] px-2 py-0.5 border border-white/20 rounded hover:bg-[#c084fc]/10 self-start"
                          disabled={!isLiveWorkspace}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {adminTab === "insights" && (
            <div className="p-5 space-y-4 text-sm">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={loadInsights}
                  disabled={isLoadingInsights}
                  className="btn btn-ghost text-xs px-3 py-1 flex gap-1"
                >
                  <BarChart3 className="h-3.5 w-3.5" /> {isLoadingInsights ? "Loading..." : "Refresh"}
                </button>
              </div>
              {insights && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="text-xs text-[#71717a] mb-1">Activity &amp; Admin Volume</div>
                    <div className="text-xl font-semibold">
                      {insights.totalActivity} total events • {insights.adminActions || 0} admin actions
                    </div>
                    <div className="text-[10px] mt-1 text-[#a1a1aa]">Last analyzed: {insights.lastAnalyzed}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="text-xs text-[#71717a] mb-1">Overdue Trends</div>
                    <div className="text-xl font-semibold text-[#ff3366]">{insights.overdueCount} overdue now</div>
                    <div className="text-xs mt-1">
                      By priority:{" "}
                      {Object.entries(insights.overdueByPriority || {})
                        .map(([p, c]) => `${p}:${c}`)
                        .join("  ") || "—"}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10 md:col-span-2">
                    <div className="text-xs text-[#71717a] mb-1.5">Top contributors</div>
                    {insights.topContributors?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {insights.topContributors.map(([u, count], i) => (
                          <div key={i} className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono">
                            {u.slice(0, 12)}: <span className="text-[#c084fc]">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-[#71717a]">No data</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Danger zone */}
      {isOwner && (
        <div className="glass rounded-2xl border border-red-500/20 p-5">
          <div className="flex items-center gap-2 text-red-400 text-xs uppercase tracking-widest mb-3">
            <Trash2 className="h-3.5 w-3.5" />
            Danger zone
          </div>
          {workspaceDeleteGuard.allowed ? (
            <>
              <p className="text-[11px] text-[#a1a1aa] mb-3 leading-relaxed">
                Deleting removes this workspace, all tasks, notes, members, and invites permanently. You will be switched
                to another workspace.
              </p>
              <input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={`Type "${currentWorkspace.name}" to confirm`}
                className="w-full bg-[#111114] border border-red-500/30 rounded-xl px-3 py-2 text-xs mb-2"
              />
              <button
                type="button"
                onClick={handleDeleteWorkspace}
                disabled={
                  isSavingSettings || isDeletingWorkspace || deleteConfirmName.trim() !== currentWorkspace.name
                }
                className="w-full py-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {isDeletingWorkspace ? "Deleting..." : "Delete workspace forever"}
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-[#a1a1aa] leading-relaxed">
              {workspaceDeleteGuard.reason}
            </div>
          )}
        </div>
      )}

      <ConfirmationModal
        open={pendingLeave}
        onOpenChange={setPendingLeave}
        title="Leave this workspace?"
        highlight={currentWorkspace.name}
        description="You will lose access to all tasks, notes, and team chat in this workspace."
        confirmText="Leave workspace"
        variant="destructive"
        onConfirm={handleLeaveWorkspace}
      />

      <ConfirmationModal
        open={pendingTransfer}
        onOpenChange={setPendingTransfer}
        title="Transfer workspace ownership?"
        highlight={
          transferCandidates.find((m) => m.userId === transferTargetId)?.fullName ||
          transferCandidates.find((m) => m.userId === transferTargetId)?.username ||
          "Selected member"
        }
        description="This member will become the workspace owner. You will be downgraded to admin. This cannot be undone from here without their cooperation."
        confirmText={isTransferring ? "Transferring…" : "Transfer ownership"}
        variant="destructive"
        onConfirm={handleTransferOwnership}
      />
    </div>
  );
}