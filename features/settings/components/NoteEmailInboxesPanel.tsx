"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Copy, Plus, Trash2, Power, PowerOff, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTaskStore } from "@/store/useTaskStore";
import { getNoteDepth, isEligibleEmailInboxParent } from "@/lib/notes/noteDepth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type { NoteEmailInboxDto } from "@/lib/email-inbox/noteInboxService";

export function NoteEmailInboxesPanel() {
  const { currentWorkspace, notes } = useTaskStore();
  const [inboxes, setInboxes] = useState<NoteEmailInboxDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<NoteEmailInboxDto | null>(null);

  const eligibleParents = useMemo(() => {
    const refs = notes.map((n) => ({ id: n.id, parentNoteId: n.parentNoteId ?? null }));
    return notes
      .map((note) => ({
        note,
        depth: getNoteDepth(note.id, refs),
      }))
      .filter(({ depth }) => isEligibleEmailInboxParent(depth))
      .sort((a, b) => (a.note.title || "").localeCompare(b.note.title || ""));
  }, [notes]);

  const workspaceId = currentWorkspace.id?.trim() ?? "";
  const isDemoWorkspace = !workspaceId || ["w1", "w2"].includes(workspaceId);

  const fetchInboxes = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured() || ["w1", "w2"].includes(workspaceId)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace/note-inboxes?workspaceId=${workspaceId}`);
      const data = await res.json();
      if (res.ok) setInboxes(data.inboxes ?? []);
    } catch {
      // table may not exist yet
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchInboxes();
  }, [fetchInboxes]);

  const handleCreate = async () => {
    if (!selectedParentId || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspace/note-inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          parentNoteId: selectedParentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "parent_depth_not_allowed"
            ? "That note cannot receive sub-notes. Pick a main or child note."
            : data.error ?? "Could not create inbox";
        toast.error(msg);
        return;
      }
      setInboxes((prev) => [data.inbox, ...prev]);
      setShowCreate(false);
      setSelectedParentId("");
      toast.success("File inbox created — copy the address below");
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

  const toggleActive = async (inbox: NoteEmailInboxDto) => {
    const res = await fetch(`/api/workspace/note-inboxes/${inbox.id}`, {
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
    setInboxes((prev) => prev.map((i) => (i.id === inbox.id ? data.inbox : i)));
    toast.success(data.inbox.isActive ? "Inbox enabled" : "Inbox disabled");
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const res = await fetch(
      `/api/workspace/note-inboxes/${id}?workspaceId=${currentWorkspace.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error("Could not delete inbox");
      return;
    }
    setInboxes((prev) => prev.filter((i) => i.id !== id));
    toast.success("Inbox deleted");
  };

  if (!workspaceId) {
    return <div className="text-xs text-[#71717a]">Loading workspace…</div>;
  }

  if (!isSupabaseConfigured() || isDemoWorkspace) {
    return (
      <div className="settings-inbox-hint rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-[#71717a]">
        File inboxes are available in live workspaces after you run the email migration scripts.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 md:space-y-4">
        <p className="text-[11px] md:text-xs text-[#71717a] leading-relaxed">
          Pick a parent file, get a private address, and every email sent there lands in{" "}
          <strong className="font-medium text-[#a1a1aa]">Review</strong> as a child record with the
          subject as the title. Anyone with the address can send in.
        </p>

        {!showCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 rounded-xl border border-[#c084fc]/30 bg-[#c084fc]/10 px-4 py-2.5 text-sm text-[#e9d5ff] hover:bg-[#c084fc]/15 min-h-[40px]"
          >
            <Plus className="h-4 w-4" />
            Create file inbox
          </button>
        ) : (
          <div className="settings-inbox-create rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-xs uppercase tracking-widest text-[#a1a1aa]">1. Choose parent file</div>
            <div className="relative">
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="input w-full appearance-none rounded-xl px-4 py-2.5 pr-10 text-sm"
              >
                <option value="">Select a main or child file…</option>
                {eligibleParents.map(({ note, depth }) => (
                  <option key={note.id} value={note.id}>
                    {depth > 0 ? "↳ " : ""}
                    {note.title?.trim() || "Untitled note"}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717a]" />
            </div>
            {eligibleParents.length === 0 && (
              <p className="text-[11px] text-[#71717a]">
                Create a file first. Grandchild files cannot be parents.
              </p>
            )}
            <div className="settings-inbox-actions flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!selectedParentId || creating}
                className="btn btn-primary text-sm px-4 py-2 disabled:opacity-50 min-h-[40px]"
              >
                {creating ? (
                  <>
                    <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                    Generating…
                  </>
                ) : (
                  "Generate address"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setSelectedParentId("");
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[#a1a1aa] hover:bg-white/5 min-h-[40px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-xs text-[#71717a]">Loading inboxes…</div>
        ) : inboxes.length > 0 ? (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-widest text-[#a1a1aa]">Your inboxes</div>
            {inboxes.map((inbox) => (
              <div
                key={inbox.id}
                className={`settings-inbox-card rounded-xl border p-4 space-y-3 ${
                  inbox.isActive ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#e5e5e7] truncate">
                      {inbox.label || inbox.parentNoteTitle || "Email inbox"}
                    </div>
                    <div className="text-[11px] text-[#71717a] mt-0.5">
                      Parent: {inbox.parentNoteTitle || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleActive(inbox)}
                      className="rounded-lg p-2 text-[#a1a1aa] hover:bg-white/10 hover:text-white"
                      title={inbox.isActive ? "Disable inbox" : "Enable inbox"}
                    >
                      {inbox.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(inbox)}
                      className="rounded-lg p-2 text-[#71717a] hover:bg-red-500/10 hover:text-red-400"
                      title="Delete inbox"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="settings-inbox-email flex items-center gap-2 rounded-xl border border-[#c084fc]/20 bg-[#c084fc]/5 px-3 py-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-[#c084fc] hidden sm:block" />
                  <code className="flex-1 min-w-0 text-xs text-[#e9d5ff] font-mono break-all sm:truncate">
                    {inbox.emailAddress}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyAddress(inbox.emailAddress)}
                    className="settings-inbox-copy flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[#a1a1aa] hover:bg-white/10 hover:text-white shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>

                {!inbox.isActive && (
                  <div className="text-[10px] text-amber-400/90">Disabled — emails to this address are ignored.</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#71717a]">No inboxes yet.</div>
        )}
      </div>

      <ConfirmationModal
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete email inbox?"
        highlight={pendingDelete?.emailAddress}
        description="Future emails to this address will not create files."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}