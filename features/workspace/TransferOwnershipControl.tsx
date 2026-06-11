"use client";

import { useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { formatRoleLabel } from "@/lib/roles";
import { useTaskStore } from "@/store/useTaskStore";
import type { WorkspaceMember } from "@/types";

type TransferOwnershipControlProps = {
  members: WorkspaceMember[];
  currentUserId?: string;
  disabled?: boolean;
  /** Team member row — select + button beside the leave hint */
  variant?: "compact" | "panel";
};

export function TransferOwnershipControl({
  members,
  currentUserId,
  disabled = false,
  variant = "compact",
}: TransferOwnershipControlProps) {
  const transferWorkspaceOwnership = useTaskStore((s) => s.transferWorkspaceOwnership);
  const [targetId, setTargetId] = useState("");
  const [pending, setPending] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const candidates = useMemo(
    () => members.filter((m) => m.userId && m.userId !== currentUserId),
    [members, currentUserId],
  );

  const targetMember = candidates.find((m) => m.userId === targetId);
  const targetLabel =
    targetMember?.fullName ||
    (targetMember?.username ? `@${targetMember.username}` : "the selected member");

  const handleConfirm = async () => {
    if (!targetId) return;
    setIsTransferring(true);
    try {
      const ok = await transferWorkspaceOwnership(targetId);
      if (ok) {
        setTargetId("");
        setPending(false);
      }
    } finally {
      setIsTransferring(false);
    }
  };

  const selectControl = (
    <select
      value={targetId}
      onChange={(e) => setTargetId(e.target.value)}
      disabled={disabled || isTransferring || candidates.length === 0}
      className="bg-bg-secondary border border-border-glass rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-neon-purple max-w-[9.5rem] truncate"
      aria-label="Select member to receive ownership"
    >
      <option value="">Select member…</option>
      {candidates.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.fullName || (m.username ? `@${m.username}` : "Member")} ({formatRoleLabel(m.role)})
        </option>
      ))}
    </select>
  );

  const transferButton = (
    <button
      type="button"
      onClick={() => targetId && setPending(true)}
      disabled={disabled || !targetId || isTransferring || candidates.length === 0}
      className="btn btn-secondary text-xs px-3 py-1.5 whitespace-nowrap disabled:opacity-50"
    >
      {isTransferring ? "Transferring…" : "Transfer ownership"}
    </button>
  );

  if (variant === "panel") {
    return (
      <>
        <div className="transfer-ownership-control glass rounded-2xl border border-neon-purple/25 p-5 space-y-4">
          <div className="flex items-center gap-2 font-medium text-sm uppercase tracking-widest text-neon-purple">
            <Crown className="h-4 w-4" />
            Transfer ownership
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Hand off this workspace to another member. They become owner immediately — no acceptance
            required. You will become an admin and can then leave the workspace if you want.
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            As owner, you cannot leave until ownership has been transferred.
          </p>
          {candidates.length === 0 ? (
            <p className="text-xs text-text-muted">Invite at least one other member before you can transfer ownership.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                disabled={disabled || isTransferring}
                className="flex-1 bg-bg-secondary border border-border-glass rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon-purple"
              >
                <option value="">Select a member…</option>
                {candidates.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName || (m.username ? `@${m.username}` : "Member")} ({formatRoleLabel(m.role)})
                  </option>
                ))}
              </select>
              {transferButton}
            </div>
          )}
        </div>

        <ConfirmationModal
          open={pending}
          onOpenChange={setPending}
          title="Transfer workspace ownership?"
          highlight={targetLabel}
          description="This member will immediately become the owner — they do not need to accept. You will become an admin and may leave afterward if you choose."
          confirmText={isTransferring ? "Transferring…" : "Transfer ownership"}
          variant="destructive"
          isLoading={isTransferring}
          onConfirm={handleConfirm}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2 shrink-0 max-w-[15rem]">
        <span
          className="text-[10px] text-text-muted text-right leading-snug"
          title="Transfer ownership before you can leave this workspace"
        >
          Transfer ownership to leave
        </span>
        {candidates.length === 0 ? (
          <span className="text-[10px] text-text-muted text-right">Invite a teammate first</span>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selectControl}
            {transferButton}
          </div>
        )}
      </div>

      <ConfirmationModal
        open={pending}
        onOpenChange={setPending}
        title="Transfer workspace ownership?"
        highlight={targetLabel}
        description="They become owner immediately. You become an admin and can leave the team afterward."
        confirmText={isTransferring ? "Transferring…" : "Transfer ownership"}
        variant="destructive"
        isLoading={isTransferring}
        onConfirm={handleConfirm}
      />
    </>
  );
}