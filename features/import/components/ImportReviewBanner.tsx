"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { RemainingReviewMark } from "./RemainingReviewMark";
import { bumpImportReviewStartCount, readImportReviewSession } from "../lib/reviewSession";
import { useTaskStore } from "@/store/useTaskStore";
import "../import.css";

interface ImportReviewBannerProps {
  count: number;
  onReview: () => void;
  className?: string;
}

export function ImportReviewBanner({ count, onReview, className }: ImportReviewBannerProps) {
  const workspaceId = useTaskStore((s) => s.currentWorkspace.id);
  const [session, setSession] = useState(() => ({ resumeTaskId: null as string | null, startCount: count }));
  useEffect(() => {
    bumpImportReviewStartCount(workspaceId, count);
    setSession(readImportReviewSession(workspaceId));
  }, [workspaceId, count]);

  if (count <= 0) return null;

  const startCount = Math.max(session.startCount, count);
  const inProgress = Boolean(session.resumeTaskId);

  return (
    <div className={cn("import-review-banner mb-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <RemainingReviewMark remaining={count} total={startCount} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">
            {count.toLocaleString()} remaining to review
          </div>
          <p className="text-[11px] text-text-muted mt-0.5">
            {inProgress
              ? "Pick up where you left off. Edits stay until you approve."
              : "Check titles, due dates, repeats, and notes, then approve each one."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReview}
        className="btn btn-primary shrink-0 inline-flex items-center gap-2 text-xs md:text-sm px-3 py-2 min-h-[40px]"
      >
        <span className="import-review-banner__count tabular-nums">
          {count.toLocaleString()}
        </span>
        {inProgress ? "Continue review" : "Review"}
      </button>
    </div>
  );
}
