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
    return <div className="text-xs text-[#71717a]">Loading workspace…</div>;
  }

  if (!isSupabaseConfigured() || isDemoWorkspace) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-[#71717a]">
        Task email inboxes are available in live workspaces after database migration.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-xs text-[#71717a] leading-relaxed">
          Generate one private address for this workspace. Every email sent there creates a task —
          the <span className="text-[#e5e5e7]">subject becomes the task title</span>. Put optional
          details in the body.
        </p>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#a1a1aa]">
            <ListTodo className="h-3.5 w-3.5 text-[#c084fc]" />
            Due date (optional)
          </div>
          <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
            Add a <code className="text-[#e9d5ff]">Due:</code> line as the{" "}
            <span className="text-[#e5e5e7]">first line of the email body</span>. Examples:
          </p>
          <ul className="text-[11px] text-[#71717a] space-y-1 font-mono">
            <li>Due: 2026-06-15</li>
            <li>Due: tomorrow</li>
            <li>Due: next friday</li>
            <li>Due: 6/15/2026</li>
          </ul>
          <p className="text-[10px] text-[#71717a] leading-relaxed">
            The due line is removed from the task description. Everything else in the body becomes
            the description.
          </p>
        </div>

        {!inbox ? (
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-xl border border-[#c084fc]/30 bg-[#c084fc]/10 px-4 py-2.5 text-sm text-[#e9d5ff] hover:bg-[#c084fc]/15 disabled:opacity-50"
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
          <div className="text-xs text-[#71717a]">Loading inbox…</div>
        ) : inbox ? (
          <div
            className={`rounded-xl border p-4 space-y-3 ${
              inbox.isActive ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#e5e5e7] truncate">
                  {inbox.label || "Task email inbox"}
                </div>
                <div className="text-[11px] text-[#71717a] mt-0.5">One address per workspace</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={toggleActive}
                  className="rounded-lg p-2 text-[#a1a1aa] hover:bg-white/10 hover:text-white"
                  title={inbox.isActive ? "Disable inbox" : "Enable inbox"}
                >
                  {inbox.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(true)}
                  className="rounded-lg p-2 text-[#71717a] hover:bg-red-500/10 hover:text-red-400"
                  title="Delete inbox"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#c084fc]/20 bg-[#c084fc]/5 px-3 py-2.5">
              <Mail className="h-4 w-4 shrink-0 text-[#c084fc]" />
              <code className="flex-1 truncate text-xs text-[#e9d5ff] font-mono">
                {inbox.emailAddress}
              </code>
              <button
                type="button"
                onClick={() => copyAddress(inbox.emailAddress)}
                className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[#a1a1aa] hover:bg-white/10 hover:text-white"
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
          <div className="text-xs text-[#71717a]">No task inbox yet.</div>
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