"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Mail, Copy, Plus, Trash2, Power, PowerOff, Loader2, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { useTaskStore } from "@/store/useTaskStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type { TaskEmailInboxDto } from "@/lib/email-inbox/taskInboxService";

export function TaskEmailInboxesPanel() {
  const { currentWorkspace } = useTaskStore();
  const [inbox, setInbox] = useState<TaskEmailInboxDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const workspaceId = currentWorkspace.id?.trim() ?? "";
  const isDemoWorkspace = !workspaceId || ["w1", "w2"].includes(workspaceId);

  const fetchInbox = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured() || ["w1", "w2"].includes(workspaceId)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace/task-inboxes?workspaceId=${workspaceId}`);
      const data = await res.json();
      if (res.ok) setInbox(data.inboxes?.[0] ?? null);
    } catch {
      // table may not exist yet
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const handleCreate = async () => {
    if (creating || inbox) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspace/task-inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: currentWorkspace.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "inbox_already_exists"
            ? "This workspace already has a task email address."
            : data.error ?? "Could not create inbox";
        toast.error(msg);
        return;
      }
      setInbox(data.inbox);
      toast.success("Task email address created — copy it below");
    } finally {
      setCreating(false);
    }
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied");
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  };

  const toggleActive = async () => {
    if (!inbox) return;
    const res = await fetch(`/api/workspace/task-inboxes/${inbox.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: currentWorkspace.id,
        isActive: !inbox.isActive,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Could not update inbox");
      return;
    }
    setInbox(data.inbox);
    toast.success(data.inbox.isActive ? "Inbox enabled" : "Inbox disabled");
  };

  const handleDelete = async () => {
    if (!inbox) return;
    const id = inbox.id;
    setPendingDelete(false);
    const res = await fetch(
      `/api/workspace/task-inboxes/${id}?workspaceId=${currentWorkspace.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error("Could not delete inbox");
      return;
    }
    setInbox(null);
    toast.success("Task inbox deleted");
  };

  if (!workspaceId) {
    return <div className="text-xs text-text-muted">Loading workspace…</div>;
  }

  if (!isSupabaseConfigured() || isDemoWorkspace) {
    return (
      <div className="settings-inbox-hint rounded-xl border border-border-glass bg-surface-hover px-4 py-3 text-xs text-text-muted">
        Task email inboxes are available in live workspaces after database migration.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:space-y-4">
        <p className="text-[11px] md:text-xs text-text-muted leading-relaxed">
          Generate one private address for this workspace. Every email sent there creates a task —
          the <span className="text-text-primary">subject becomes the task title</span>. Put optional
          details in the body.
        </p>

        <div className="settings-inbox-hint rounded-xl border border-border-glass bg-surface-hover p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-text-secondary">
            <ListTodo className="h-3.5 w-3.5 text-neon-purple" />
            Due date (optional)
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Add a <code className="text-neon-purple-tint">Due:</code> line as the{" "}
            <span className="text-text-primary">first line of the email body</span>. Examples:
          </p>
          <ul className="text-[11px] text-text-muted space-y-1 font-mono">
            <li>Due: 2026-06-15</li>
            <li>Due: tomorrow</li>
            <li>Due: next friday</li>
            <li>Due: 6/15/2026</li>
          </ul>
          <p className="text-[10px] text-text-muted leading-relaxed">
            The due line is removed from the task description. Everything else in the body becomes
            the description.
          </p>
        </div>

        {!inbox ? (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="settings-inbox-create w-full md:w-auto flex items-center justify-center gap-2 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-4 py-2.5 text-sm text-neon-purple-tint hover:bg-neon-purple/15 disabled:opacity-50 min-h-[40px]"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Generate task email address
              </>
            )}
          </button>
        ) : null}

        {loading ? (
          <div className="text-xs text-text-muted">Loading inbox…</div>
        ) : inbox ? (
          <div
            className={`settings-inbox-card rounded-xl border p-4 space-y-3 ${
              inbox.isActive ? "border-border-glass bg-surface-hover" : "border-border-glass/60 bg-surface-hover/50 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {inbox.label || "Task email inbox"}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">One address per workspace</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={toggleActive}
                  className="rounded-lg p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  title={inbox.isActive ? "Disable inbox" : "Enable inbox"}
                >
                  {inbox.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(true)}
                  className="rounded-lg p-2 text-text-muted hover:bg-red-500/10 hover:text-red-400"
                  title="Delete inbox"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="settings-inbox-email flex items-center gap-2 rounded-xl border border-neon-purple/20 bg-neon-purple/5 px-3 py-2.5">
              <Mail className="h-4 w-4 shrink-0 text-neon-purple hidden sm:block" />
              <code className="flex-1 min-w-0 text-xs text-neon-purple-tint font-mono break-all sm:truncate">
                {inbox.emailAddress}
              </code>
              <button
                type="button"
                onClick={() => copyAddress(inbox.emailAddress)}
                className="settings-inbox-copy flex items-center gap-1 rounded-lg border border-border-glass px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-text-secondary hover:bg-surface-hover hover:text-text-primary shrink-0"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>

            {!inbox.isActive && (
              <div className="text-[10px] text-amber-400/90">
                Disabled — emails to this address are ignored.
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-text-muted">No task inbox yet.</div>
        )}
      </div>

      <ConfirmationModal
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        onConfirm={handleDelete}
        title="Delete task email inbox?"
        highlight={inbox?.emailAddress}
        description="Future emails to this address will not create tasks."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}