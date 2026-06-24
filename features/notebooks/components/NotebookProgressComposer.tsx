"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface NotebookProgressComposerProps {
  placeholder?: string;
  disabled?: boolean;
  onSubmit: (body: string) => void | Promise<void>;
}

export function NotebookProgressComposer({
  placeholder = "Add a progress note…",
  disabled,
  onSubmit,
}: NotebookProgressComposerProps) {
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || disabled || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody("");
    } catch {
      toast.error("Could not save note");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-border-glass p-3 bg-bg">
      <div className="flex gap-2 items-end">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          disabled={disabled || isSubmitting}
          placeholder={placeholder}
          rows={2}
          className="flex-1 resize-none bg-bg-secondary border border-border-glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint min-h-[44px]"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled || isSubmitting || !body.trim()}
          className="shrink-0 flex items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 min-h-[44px] min-w-[44px] text-neon-purple-tint disabled:opacity-40"
          aria-label="Save note"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}