"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MEETING_TEMPLATES } from "@/lib/meetings/agendaTemplates";
import { cn } from "@/lib/utils";

interface CreateMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { title: string; scheduledAt?: string; templateId?: string }) => void | Promise<void>;
}

function parseScheduledAt(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function CreateMeetingModal({ open, onOpenChange, onCreate }: CreateMeetingModalProps) {
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setScheduledAt("");
      setTemplateId(undefined);
      setDateError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const handleCreate = async () => {
    const iso = scheduledAt ? parseScheduledAt(scheduledAt) : undefined;
    if (scheduledAt && !iso) {
      setDateError("Enter a valid date and time.");
      return;
    }
    setDateError(null);
    setIsSubmitting(true);
    try {
      await onCreate({
        title: title.trim() || "Untitled meeting",
        scheduledAt: iso,
        templateId,
      });
    } finally {
      setIsSubmitting(false);
      onOpenChange(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-meeting-title"
        className="w-full max-w-md rounded-2xl border border-border-glass bg-bg p-5 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-meeting-title" className="text-lg font-semibold text-text-primary">
          Schedule meeting
        </h2>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder="Weekly sync"
            autoFocus
            className="w-full bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Date & time (optional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => {
              setScheduledAt(e.target.value);
              setDateError(null);
            }}
            className="w-full bg-bg-secondary border border-border-glass rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40"
          />
          {dateError && <p className="text-xs text-red-400">{dateError}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Template (optional)</label>
          <div className="grid grid-cols-2 gap-2">
            {MEETING_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(templateId === t.id ? undefined : t.id)}
                className={cn(
                  "text-left p-3 rounded-xl border text-sm transition",
                  templateId === t.id
                    ? "border-neon-purple/40 bg-neon-purple/10 text-neon-purple-tint"
                    : "border-border-glass hover:bg-surface-hover text-text-secondary",
                )}
              >
                <div className="font-semibold">{t.label}</div>
                <div className="text-xs text-text-muted mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isSubmitting}
            className="btn btn-primary px-4 py-2 text-sm inline-flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}