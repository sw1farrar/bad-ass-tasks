"use client";

import React, { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/apiFetch";
import type { ArchiveTitleContext } from "@/lib/files/archiveTitleRules";
import { fetchNoteAttachments } from "@/lib/notes/noteAttachmentListCache";
import { useTaskStore } from "@/store/useTaskStore";
import { cn } from "@/lib/utils";

export type ArchiveTitleSuggestion = {
  title: string;
  memo?: string;
  tags?: string[];
};

interface SuggestArchiveTitleButtonProps {
  noteId: string;
  context?: ArchiveTitleContext;
  availableTags?: string[];
  disabled?: boolean;
  onSuggested: (suggestion: ArchiveTitleSuggestion) => void;
}

function buildContextFromNote(
  base: ArchiveTitleContext | undefined,
  hydrated: {
    title?: string;
    searchPlain?: string | null;
    rawHtml?: string | null;
    content?: string;
    memo?: string | null;
    recordType?: string;
    createdAt?: string;
  } | null,
): ArchiveTitleContext {
  if (!hydrated) return base ?? {};
  return {
    ...base,
    title: base?.title ?? hydrated.title,
    searchPlain: base?.searchPlain ?? hydrated.searchPlain,
    emailHtml: base?.emailHtml ?? hydrated.rawHtml,
    noteContent: base?.noteContent ?? hydrated.content,
    memo: base?.memo ?? hydrated.memo ?? undefined,
    recordType: base?.recordType ?? hydrated.recordType,
    createdAt: base?.createdAt ?? hydrated.createdAt,
  };
}

function errorDescription(error: string, serverMessage?: string): string {
  if (serverMessage?.trim()) return serverMessage.trim();
  if (error === "dual_auth_required") {
    return "Complete email verification, then try again.";
  }
  if (error === "ai_unavailable") {
    return "Add XAI_API_KEY to .env.local (from console.x.ai), then restart the dev server.";
  }
  if (error === "suggestion_rejected") {
    return "The AI could not name this confidently. Try again or name it manually.";
  }
  return "Check your connection and try again.";
}

export function SuggestArchiveTitleButton({
  noteId,
  context,
  availableTags = [],
  disabled = false,
  onSuggested,
}: SuggestArchiveTitleButtonProps) {
  const [loading, setLoading] = useState(false);
  const hydrateNoteDetail = useTaskStore((s) => s.hydrateNoteDetail);

  const handleSuggest = async () => {
    if (loading || disabled) return;
    setLoading(true);
    let serverMessage: string | undefined;
    try {
      const hydrated = await hydrateNoteDetail(noteId);
      let attachmentFileNames = context?.attachmentFileNames;
      let attachmentTexts = context?.attachmentTexts;

      try {
        const attachments = await fetchNoteAttachments(noteId);
        if (attachments.length) {
          attachmentFileNames = attachments.map((a) => a.fileName);
        }
      } catch {
        // attachment list optional
      }

      const enrichedContext: ArchiveTitleContext = {
        ...buildContextFromNote(context, hydrated),
        attachmentFileNames,
        attachmentTexts,
      };

      const res = await apiFetch("/api/ai/suggest-archive-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId,
          context: enrichedContext,
          availableTags,
        }),
      });

      let data: {
        ok?: boolean;
        filename?: string;
        title?: string;
        memo?: string;
        tags?: string[];
        reasoning?: string;
        source?: "ai";
        receiptItemsLogged?: number;
        error?: string;
        reason?: string;
        message?: string;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw new Error("invalid_response");
      }

      if (res.status === 403 && data.error === "dual_auth_required") {
        throw new Error("dual_auth_required");
      }
      if (res.status === 503 && data.error === "ai_unavailable") {
        serverMessage = data.message;
        throw new Error("ai_unavailable");
      }
      if (res.status === 422 && data.error === "suggestion_rejected") {
        throw new Error("suggestion_rejected");
      }

      const filename = (data.filename ?? data.title ?? "").trim();
      if (!res.ok || !filename) {
        throw new Error(data.error ?? `suggest_failed_${res.status}`);
      }

      const memo = data.memo?.trim();
      const tags = (data.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
      onSuggested({
        title: filename,
        memo: memo || undefined,
        tags: tags.length ? tags : undefined,
      });
      const tagSummary = tags.length ? `Tags: ${tags.join(", ")}` : undefined;
      const receiptSummary =
        data.receiptItemsLogged && data.receiptItemsLogged > 0
          ? `${data.receiptItemsLogged} receipt item${data.receiptItemsLogged === 1 ? "" : "s"} logged`
          : undefined;
      toast.success("AI filled review details", {
        description: receiptSummary || tagSummary || memo || data.reasoning?.trim() || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "suggest_failed";
      toast.error("Could not suggest a name", {
        description: errorDescription(message, serverMessage),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleSuggest()}
      disabled={disabled || loading}
      className={cn(
        "suggest-archive-title-btn inline-flex items-center gap-1 rounded-lg border border-neon-purple/30 bg-neon-purple/10 px-2 py-1 text-[10px] font-semibold text-neon-purple transition",
        "hover:border-neon-purple/50 hover:bg-neon-purple/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40",
        "disabled:opacity-50 disabled:pointer-events-none min-h-[28px]",
      )}
      title="Analyze content with AI and suggest title, tags, and memo"
      aria-label="Suggest title, tags, and memo with AI"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
      ) : (
        <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
      )}
      <span>{loading ? "Reading…" : "AI name"}</span>
    </button>
  );
}