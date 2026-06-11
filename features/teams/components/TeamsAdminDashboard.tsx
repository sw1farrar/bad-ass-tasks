"use client";

import React, { useState } from "react";
import {
  Settings,
  BarChart3,
  FileDown,
  Upload,
  FileText,
  Users,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import { ActivityLog, Note, Task, WorkspaceMember } from "@/types";
import { isDueDatePast } from "@/lib/datetime";

type AdminTab = "overview" | "exports" | "imports" | "templates" | "insights";

export interface TeamsAdminInsights {
  totalActivity: number;
  adminActions?: number;
  topContributors?: Array<[string, number]>;
  overdueCount: number;
  overdueByPriority?: Record<string, number>;
  lastAnalyzed: string;
}

export interface TeamsAdminDashboardProps {
  currentWorkspace: { id: string; name: string };
  myRole: string;
  isSingleOwnerWorkspace: boolean;
  isLiveWorkspace: boolean;
  tasks: Task[];
  notes: Note[];
  members: WorkspaceMember[];
  recentActivity: ActivityLog[];
  onOpenWorkspaceSettings: () => void;
  canEditWorkspaceDetails?: boolean;
}

export function TeamsAdminDashboard({
  currentWorkspace,
  myRole,
  isSingleOwnerWorkspace,
  isLiveWorkspace,
  tasks,
  notes,
  members,
  recentActivity,
  onOpenWorkspaceSettings,
  canEditWorkspaceDetails = false,
}: TeamsAdminDashboardProps) {
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [importStrategy, setImportStrategy] = useState<"append" | "skip-dupe-titles">(
    "skip-dupe-titles"
  );
  const [importPreview, setImportPreview] = useState<{
    tasks: number;
    notes: number;
    source: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [insights, setInsights] = useState<TeamsAdminInsights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const liveBlocked = !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id);

  const loadInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const hybrid = await import("@/lib/data/hybridStore");
      const fullActivity = await hybrid.getRecentActivity(currentWorkspace.id, 500);
      const contribMap: Record<string, number> = {};
      fullActivity.forEach((a: ActivityLog) => {
        const key = a.userId || "unknown";
        contribMap[key] = (contribMap[key] || 0) + 1;
      });
      const topContribs = Object.entries(contribMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const adminActions = fullActivity.filter((a) =>
        (a.actionType || "").startsWith("admin.")
      ).length;
      const overdueNow = tasks.filter(
        (t) => t.dueDate && isDueDatePast(t.dueDate) && t.status !== "done"
      );
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
      toast.success("Deep insights loaded");
    } catch {
      const contribMap: Record<string, number> = {};
      recentActivity.forEach((a) => {
        const k = a.userId || "anon";
        contribMap[k] = (contribMap[k] || 0) + 1;
      });
      setInsights({
        totalActivity: recentActivity.length,
        topContributors: Object.entries(contribMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        overdueCount: tasks.filter(
          (t) => t.dueDate && isDueDatePast(t.dueDate) && t.status !== "done"
        ).length,
        lastAnalyzed: "local (limited)",
      });
    } finally {
      setIsLoadingInsights(false);
    }
  };

  return (
    <div className="teams-admin-dashboard glass rounded-2xl border border-border-glass overflow-hidden">
      <div className="teams-admin-header px-5 py-3 border-b border-border-glass bg-surface-hover">
        <div className="font-semibold flex items-center gap-2 text-base md:text-lg tracking-tight mb-0.5 md:mb-1">
          <BarChart3 className="h-5 w-5 text-neon-purple shrink-0" /> Data &amp; admin
        </div>
        <p className="text-[11px] text-text-muted mb-2 md:mb-3 hidden md:block">
          Export, import, templates, and workspace insights for your team.
        </p>

        <div className="teams-admin-tabs flex gap-1 text-xs overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory touch-pan-x">
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
                onClick={() => setAdminTab(tab.id)}
                className={cn(
                  "teams-admin-tab flex items-center gap-1.5 px-3 py-2 min-h-[44px] snap-start rounded-xl border transition-all shrink-0",
                  active
                    ? "teams-admin-tab--active bg-neon-purple text-accent-on border-neon-purple font-medium"
                    : "bg-surface-hover border-border-glass hover:bg-surface-hover text-text-secondary hover:text-text-primary",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {adminTab === "overview" && (
        <div className="teams-admin-body p-4 md:p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <div className="bg-surface-hover rounded-xl p-3 border border-border-glass">
              <div className="text-text-muted text-xs flex items-center gap-1">
                Tasks <span className="text-emerald-400">•</span> Done
              </div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {tasks.length}{" "}
                <span className="text-xs text-text-secondary">
                  / {tasks.filter((t) => t.status === "done").length}
                </span>
              </div>
            </div>
            <div className="bg-surface-hover rounded-xl p-3 border border-border-glass">
              <div className="text-text-muted text-xs">Notes • Team Size</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {notes.length}{" "}
                <span className="text-xs text-text-secondary">/ {members.length}</span>
              </div>
            </div>
            <div className="bg-surface-hover rounded-xl p-3 border border-border-glass">
              <div className="text-text-muted text-xs">Overdue • Completion</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-[var(--priority-p0)]">
                {
                  tasks.filter(
                    (t) =>
                      t.dueDate &&
                      isDueDatePast(t.dueDate) &&
                      t.status !== "done"
                  ).length
                }{" "}
                <span className="text-xs text-text-secondary">
                  / ~
                  {Math.round(
                    (tasks.filter((t) => t.status === "done").length /
                      Math.max(1, tasks.length)) *
                      100
                  )}
                  %
                </span>
              </div>
            </div>
            <div className="bg-surface-hover rounded-xl p-3 border border-border-glass">
              <div className="text-text-muted text-xs">Activity</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {recentActivity.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {adminTab === "exports" && (
        <div className="teams-admin-body p-4 md:p-5 border-t border-border-glass">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => useTaskStore.getState().exportWorkspace("json")}
              disabled={liveBlocked}
              className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" /> JSON
            </button>
            <button
              onClick={() => useTaskStore.getState().exportWorkspace("csv")}
              disabled={liveBlocked}
              className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={() => useTaskStore.getState().exportWorkspace("md")}
              disabled={liveBlocked}
              className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" /> Markdown
            </button>
            <button
              onClick={() => useTaskStore.getState().exportWorkspace("all")}
              disabled={liveBlocked}
              className="btn btn-primary text-xs px-4 py-2 flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> All
            </button>
          </div>
        </div>
      )}

      {adminTab === "imports" && (
        <div className="teams-admin-body p-4 md:p-5 border-t border-border-glass space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <div className="flex gap-2 text-xs">
                <label
                  className={`px-3 py-1 rounded-xl border cursor-pointer ${
                    importStrategy === "skip-dupe-titles"
                      ? "border-neon-purple bg-surface-hover"
                      : "border-border-glass"
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
                    importStrategy === "append"
                      ? "border-neon-purple bg-surface-hover"
                      : "border-border-glass"
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
            </div>
            <label className="btn btn-secondary text-xs px-4 py-2 cursor-pointer inline-flex items-center gap-2 mt-4">
              <Upload className="h-4 w-4" /> Choose file
              <input
                type="file"
                accept=".json,.csv,.md,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || liveBlocked) return;
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
                      const taskLines = text
                        .split("\n")
                        .filter((l) => l.match(/^\s*-\s*\[[\sx]\]/i));
                      parsed.tasks = taskLines.map((l) => ({
                        title: l.replace(/^\s*-\s*\[[\sx]\]\s*/, "").trim().slice(0, 140),
                      }));
                      const noteMatches = text.match(/^###\s+(.+)$/gm) || [];
                      parsed.notes = noteMatches.slice(0, 20).map((h: string) => ({
                        title: h.replace(/^###\s+/, "").trim(),
                      }));
                    }
                    setImportPreview({
                      tasks: parsed.tasks?.length || 0,
                      notes: parsed.notes?.length || 0,
                      source: file.name,
                    });
                    (window as Window & { __pendingImport?: unknown }).__pendingImport = parsed;
                  } catch {
                    toast.error("Failed to parse file");
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {importPreview && (
            <div className="bg-surface-hover border border-border-glass rounded-xl p-3 text-xs">
              <div>
                Preview from <span className="font-mono">{importPreview.source}</span>:
              </div>
              <div className="font-medium mt-1">
                {importPreview.tasks} tasks • {importPreview.notes} notes ready to import.
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  disabled={isImporting || liveBlocked}
                  onClick={async () => {
                    const parsed = (window as Window & { __pendingImport?: { tasks?: unknown[]; notes?: unknown[] } })
                      .__pendingImport;
                    if (!parsed) return;
                    setIsImporting(true);
                    try {
                      const res = await useTaskStore
                        .getState()
                        .importWorkspaceData(parsed, { conflictStrategy: importStrategy });
                      toast.success(
                        `Import complete: ${res.importedTasks} tasks, ${res.importedNotes} notes${
                          res.skippedTasks || res.skippedNotes
                            ? ` (skipped ${res.skippedTasks || 0} tasks, ${res.skippedNotes || 0} notes)`
                            : ""
                        }`
                      );
                      await useTaskStore.getState().initializeFromSupabase?.();
                      setImportPreview(null);
                      (window as Window & { __pendingImport?: unknown }).__pendingImport = null;
                    } catch {
                      toast.error("Import failed");
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                  className="btn btn-primary text-xs px-3 py-1"
                >
                  {isImporting
                    ? "Importing..."
                    : `Import with ${importStrategy === "skip-dupe-titles" ? "Smart Skip" : "Append"}`}
                </button>
                <button
                  onClick={() => {
                    setImportPreview(null);
                    (window as Window & { __pendingImport?: unknown }).__pendingImport = null;
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
        <div className="teams-admin-body p-4 md:p-5 border-t border-border-glass">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {(useTaskStore.getState().getAdminTemplateLibrary?.() || []).map(
              (tpl: { title: string; type: string; description?: string; tags?: string[] }, idx: number) => (
                <div
                  key={idx}
                  className="bg-surface-hover border border-border-glass rounded-xl p-3 hover:border-neon-purple/40 transition group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-1.5">
                        {tpl.title}
                        <span
                          className={cn(
                            "text-[9px] px-1 rounded",
                            tpl.type === "note"
                              ? "teams-admin-badge--note bg-blue-500/20 text-blue-300"
                              : "teams-admin-badge--task bg-emerald-500/20 text-emerald-300",
                          )}
                        >
                          {tpl.type}
                        </span>
                      </div>
                      {tpl.description && (
                        <div className="text-[10px] text-text-secondary line-clamp-2 mt-0.5 pr-2">
                          {tpl.description.slice(0, 110)}
                          {tpl.description.length > 110 ? "…" : ""}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        const res = await useTaskStore.getState().applyTemplate(tpl);
                        if (res) toast.success(`Applied: ${tpl.title}`);
                        else toast.info("Template applied (demo or error — check tasks/notes)");
                      }}
                      className="opacity-70 group-hover:opacity-100 text-neon-purple hover:text-text-primary text-[10px] px-2 py-0.5 border border-border-glass rounded hover:bg-neon-purple/10 self-start"
                      disabled={liveBlocked}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {adminTab === "insights" && (
        <div className="teams-admin-body p-4 md:p-5 border-t border-border-glass space-y-4 text-sm">
          <div className="flex items-center justify-end">
            <button
              onClick={loadInsights}
              disabled={isLoadingInsights}
              className="btn btn-ghost text-xs px-3 py-1 flex gap-1"
            >
              <BarChart3 className="h-3.5 w-3.5" />{" "}
              {isLoadingInsights ? "Loading..." : "Refresh"}
            </button>
          </div>
          {insights ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-surface-hover rounded-xl p-3 border border-border-glass">
                <div className="text-xs text-text-muted mb-1">Activity & Admin Volume</div>
                <div className="text-xl font-semibold">
                  {insights.totalActivity} total events • {insights.adminActions || 0} admin actions
                </div>
                <div className="text-[10px] mt-1 text-text-secondary">
                  Last analyzed: {insights.lastAnalyzed}
                </div>
              </div>
              <div className="bg-surface-hover rounded-xl p-3 border border-border-glass">
                <div className="text-xs text-text-muted mb-1">Overdue Trends</div>
                <div className="text-xl font-semibold text-[var(--priority-p0)]">
                  {insights.overdueCount} overdue now
                </div>
                <div className="text-xs mt-1">
                  By priority:{" "}
                  {Object.entries(insights.overdueByPriority || {})
                    .map(([p, c]) => `${p}:${c}`)
                    .join("  ") || "—"}
                </div>
              </div>
              <div className="bg-surface-hover rounded-xl p-3 border border-border-glass md:col-span-2">
                <div className="text-xs text-text-muted mb-1.5">Top contributors</div>
                {insights.topContributors?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {insights.topContributors.map(([user, count], i) => (
                      <div key={i} className="px-2 py-0.5 bg-surface-hover rounded text-xs font-mono">
                        {user.slice(0, 12)}: <span className="text-neon-purple">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-text-muted">No data</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="teams-admin-footer px-5 py-3 border-t border-border-glass bg-surface-hover/50 flex justify-end">
        <button
          onClick={onOpenWorkspaceSettings}
          className="text-xs text-neon-purple hover:underline flex items-center gap-1"
        >
          {canEditWorkspaceDetails ? "Workspace settings" : "Notification settings"} <Settings className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}