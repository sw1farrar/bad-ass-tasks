"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings, Trash2, Bell, Mail, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import { NoteEmailInboxesPanel } from "./components/NoteEmailInboxesPanel";
import { TaskEmailInboxesPanel } from "./components/TaskEmailInboxesPanel";
import { toast } from "sonner";
import { useTaskStore } from "@/store/useTaskStore";
import { canDeleteWorkspace } from "@/lib/workspaceGuards";
import type { NotificationType } from "@/types";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationTypePref,
  mergeNotificationTypePrefs,
  NOTIFICATION_TYPES,
} from "@/lib/notifications/notificationPrefs";
import "./settings-workspace.css";

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  mention: "Mentions",
  comment: "Comments",
  invite: "Workspace invites",
  task_assigned: "Task assignments",
  deadline: "Due date reminders",
  activity: "Workspace activity",
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);

  const prefs = notificationPrefs || DEFAULT_NOTIFICATION_PREFS;

  useEffect(() => {
    setSettingsName(currentWorkspace.name);
    setIsEditingName(false);
    setDeleteConfirmName("");
  }, [currentWorkspace.id, currentWorkspace.name]);

  const handleCancelNameEdit = () => {
    setSettingsName(currentWorkspace.name);
    setIsEditingName(false);
  };

  const handleSaveWorkspaceName = async () => {
    if (!isOwner) return;
    const trimmed = settingsName.trim();
    if (!trimmed) {
      toast.error("Workspace name cannot be empty");
      return;
    }
    if (trimmed === currentWorkspace.name) {
      setIsEditingName(false);
      return;
    }
    setIsSavingSettings(true);
    try {
      await updateWorkspaceDetails({ name: trimmed });
      setIsEditingName(false);
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

  const toggleTypeChannel = (
    type: NotificationType,
    channel: "inApp" | "email",
    value: boolean,
  ) => {
    updateNotificationPrefs({
      types: mergeNotificationTypePrefs(prefs.types, {
        [type]: { [channel]: value },
      }),
    });
  };

  return (
    <div className="settings-root">
      <div className="settings-workspace flex flex-col gap-3 md:gap-6 pb-8 md:pb-12">
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
        hideWorkspaceLabelOnMobile
        hideWorkspaceNameOnMobile
        className="mb-0"
      />

      <div className="settings-panel glass rounded-2xl border border-white/10 p-4 md:p-5">
        <div className="settings-panel-header text-[10px] font-medium uppercase tracking-widest text-[#71717a] mb-1.5 md:mb-2">
          Workspace
        </div>
        {isEditingName && isOwner ? (
          <div className="flex items-center gap-2 min-w-0">
            <input
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveWorkspaceName();
                if (e.key === "Escape") handleCancelNameEdit();
              }}
              className="input flex-1 min-w-0 px-4 py-2.5 rounded-xl text-sm"
              disabled={isSavingSettings}
              autoFocus
              aria-label="Workspace name"
            />
            <button
              type="button"
              onClick={() => void handleSaveWorkspaceName()}
              disabled={isSavingSettings}
              className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-[#00ff9f] hover:bg-white/5 disabled:opacity-50"
              aria-label="Save workspace name"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCancelNameEdit}
              disabled={isSavingSettings}
              className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-[#71717a] hover:text-white hover:bg-white/5 disabled:opacity-50"
              aria-label="Cancel editing workspace name"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="settings-workspace-name text-base md:text-lg font-semibold text-[#f4f4f5] truncate min-w-0">
              {currentWorkspace.name}
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setSettingsName(currentWorkspace.name);
                  setIsEditingName(true);
                }}
                disabled={isSavingSettings}
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
                  "text-[#a1a1aa] hover:text-[#c084fc] hover:bg-[#c084fc]/10 transition disabled:opacity-50",
                )}
                aria-label="Edit workspace name"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Notifications — all members */}
      <div className="settings-panel glass rounded-2xl border border-white/10 p-4 md:p-5 space-y-3 md:space-y-4">
        <div className="flex items-center gap-2 font-medium text-xs md:text-sm uppercase tracking-widest text-[#71717a]">
          <Bell className="h-4 w-4 text-[#c084fc] shrink-0" />
          Notifications
        </div>
        <p className="text-[11px] md:text-xs text-[#71717a] leading-relaxed">
          Choose in-app and email delivery for each notification type.
        </p>

        <div className="settings-notif-matrix rounded-xl border border-white/10 overflow-hidden">
          <div className="settings-notif-matrix__header grid items-center gap-2 px-3 md:px-4 py-2 border-b border-white/10 bg-white/[0.04] text-[10px] font-medium uppercase tracking-widest text-[#71717a]">
            <span>Type</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Email</span>
          </div>
          {NOTIFICATION_TYPES.map((type) => {
            const typePref = getNotificationTypePref(prefs, type);
            return (
              <div
                key={type}
                className="settings-notif-matrix__row grid items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 border-b border-white/10 last:border-b-0 text-sm"
              >
                <span className="text-[#e5e5e7] min-w-0 leading-snug">
                  {NOTIFICATION_TYPE_LABELS[type]}
                </span>
                <label className="settings-notif-matrix__check flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={typePref.inApp}
                    onChange={(e) => toggleTypeChannel(type, "inApp", e.target.checked)}
                    className="h-4 w-4 accent-[#c084fc]"
                    aria-label={`${NOTIFICATION_TYPE_LABELS[type]} in-app`}
                  />
                </label>
                <label className="settings-notif-matrix__check flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={typePref.email}
                    onChange={(e) => toggleTypeChannel(type, "email", e.target.checked)}
                    className="h-4 w-4 accent-[#c084fc]"
                    aria-label={`${NOTIFICATION_TYPE_LABELS[type]} email`}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="settings-panel glass rounded-2xl border border-white/10 p-4 md:p-5 space-y-3 md:space-y-4">
        <div className="flex items-center gap-2 font-medium text-xs md:text-sm uppercase tracking-widest text-[#71717a]">
          <Mail className="h-4 w-4 text-[#c084fc] shrink-0" />
          <span className="truncate">File inboxes</span>
        </div>
        <NoteEmailInboxesPanel />
      </div>

      <div className="settings-panel glass rounded-2xl border border-white/10 p-4 md:p-5 space-y-3 md:space-y-4">
        <div className="flex items-center gap-2 font-medium text-xs md:text-sm uppercase tracking-widest text-[#71717a]">
          <Mail className="h-4 w-4 text-[#c084fc] shrink-0" />
          <span className="truncate">Task from email</span>
        </div>
        <TaskEmailInboxesPanel />
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="settings-danger-panel glass rounded-2xl border border-red-500/20 p-4 md:p-5">
          <div className="flex items-center gap-2 text-red-400 text-[10px] md:text-xs uppercase tracking-widest mb-2 md:mb-3">
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
                className="settings-delete-input w-full bg-[#111114] border border-red-500/30 rounded-xl px-3 py-2 text-xs mb-2"
              />
              <button
                type="button"
                onClick={handleDeleteWorkspace}
                disabled={
                  isSavingSettings || isDeletingWorkspace || deleteConfirmName.trim() !== currentWorkspace.name
                }
                className="settings-delete-btn w-full py-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
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
    </div>
  );
}