"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings, Trash2, Bell, Mail } from "lucide-react";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import { NoteEmailInboxesPanel } from "./components/NoteEmailInboxesPanel";
import { TaskEmailInboxesPanel } from "./components/TaskEmailInboxesPanel";
import { toast } from "sonner";
import { useTaskStore } from "@/store/useTaskStore";
import { canDeleteWorkspace } from "@/lib/workspaceGuards";
import type { NotificationType } from "@/types";

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
    currentWorkspace,
    workspaces,
    user,
    updateWorkspaceDetails,
    deleteCurrentWorkspace,
    notificationPrefs,
    updateNotificationPrefs,
  } = useTaskStore();

  const myRole = currentWorkspace.role;
  const isOwner = myRole === "owner";

  const workspaceDeleteGuard = useMemo(
    () => canDeleteWorkspace(currentWorkspace.id, workspaces, user?.id),
    [currentWorkspace.id, workspaces, user?.id],
  );

  const [settingsName, setSettingsName] = useState(currentWorkspace.name);
  const [settingsSlug, setSettingsSlug] = useState(currentWorkspace.slug);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);

  const prefs = notificationPrefs || DEFAULT_NOTIFICATION_PREFS;

  useEffect(() => {
    setSettingsName(currentWorkspace.name);
    setSettingsSlug(currentWorkspace.slug);
    setDeleteConfirmName("");
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

  const togglePref = (key: "email" | "inApp", value: boolean) => {
    updateNotificationPrefs({ [key]: value });
  };

  const toggleTypePref = (type: NotificationType, value: boolean) => {
    updateNotificationPrefs({ types: { ...prefs.types, [type]: value } });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <WorkspaceViewHeader
        variant="inline"
        title="Settings"
        workspaceName={currentWorkspace.name}
        icon={
          isOwner ? (
            <Settings className="h-6 w-6" />
          ) : (
            <Bell className="h-6 w-6" />
          )
        }
        description={
          isOwner
            ? "Workspace details, notifications, email-to-note inboxes, and destructive actions. Team membership lives on the Team page."
            : "Notifications and email-to-note inboxes for this workspace."
        }
      />

      {isOwner && (
        <div className="glass rounded-2xl border border-white/10 p-5 space-y-4">
          <div className="font-medium text-sm uppercase tracking-widest text-[#71717a]">General</div>
          <div>
            <label className="text-xs text-[#a1a1aa] block mb-1.5">Name</label>
            <input
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              className="input w-full px-4 py-2.5 rounded-xl text-sm"
              disabled={isSavingSettings}
            />
          </div>
          <div>
            <label className="text-xs text-[#a1a1aa] block mb-1.5">Slug (unique URL-friendly ID)</label>
            <input
              value={settingsSlug}
              onChange={(e) => setSettingsSlug(e.target.value)}
              className="input w-full px-4 py-2.5 rounded-xl text-sm font-mono"
              disabled={isSavingSettings}
            />
            <div className="text-[10px] text-[#71717a] mt-1">Changing slug may affect bookmarks and invites.</div>
          </div>
          <button
            onClick={handleSaveWorkspaceSettings}
            disabled={isSavingSettings}
            className="btn btn-primary text-sm px-5 py-2 disabled:opacity-60"
          >
            {isSavingSettings ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* Notifications — all members */}
      <div className="glass rounded-2xl border border-white/10 p-5 space-y-4">
        {isOwner && (
          <>
            <div className="flex items-center gap-2 font-medium text-sm uppercase tracking-widest text-[#71717a]">
              <Bell className="h-4 w-4 text-[#c084fc]" />
              Notifications
            </div>
            <p className="text-xs text-[#71717a]">Choose how you want to be notified for this workspace.</p>
          </>
        )}

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

      <div className="glass rounded-2xl border border-white/10 p-5 space-y-4">
        <div className="flex items-center gap-2 font-medium text-sm uppercase tracking-widest text-[#71717a]">
          <Mail className="h-4 w-4 text-[#c084fc]" />
          Create note from email
        </div>
        <NoteEmailInboxesPanel />
      </div>

      <div className="glass rounded-2xl border border-white/10 p-5 space-y-4">
        <div className="flex items-center gap-2 font-medium text-sm uppercase tracking-widest text-[#71717a]">
          <Mail className="h-4 w-4 text-[#c084fc]" />
          Create task from email
        </div>
        <TaskEmailInboxesPanel />
      </div>

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

    </div>
  );
}