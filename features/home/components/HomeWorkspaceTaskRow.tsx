"use client";

import React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeFocusItem } from "../lib/buildAttentionItems";
import type { HomeTileTaskBucket } from "../lib/pickHomeTileTasks";

const BUCKET_ARIA_LABEL: Record<HomeTileTaskBucket, string> = {
  late: "past due",
  today: "due today",
  tomorrow: "due tomorrow",
  upcoming: "upcoming",
  undated: "no due date",
};

interface HomeWorkspaceTaskRowProps {
  item: HomeFocusItem;
  bucket: HomeTileTaskBucket;
  isLoading?: boolean;
  onComplete: (item: HomeFocusItem) => void | Promise<void>;
  onOpen: (item: HomeFocusItem) => void | Promise<void>;
}

export function HomeWorkspaceTaskRow({
  item,
  bucket,
  isLoading = false,
  onComplete,
  onOpen,
}: HomeWorkspaceTaskRowProps) {
  const isDone = item.task.status === "done";

  return (
    <div className={cn("home-ws-task-row", `home-ws-task-row--${bucket}`)} role="listitem">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isLoading) void onComplete(item);
        }}
        disabled={isLoading}
        className={cn("task-complete-btn home-ws-task-row__check", isDone && "is-done")}
        aria-label={
          isDone ? "Reopen task" : isLoading ? "Updating task" : "Mark complete"
        }
      >
        {isLoading ? (
          <Loader2 className="home-ws-task-row__spinner animate-spin" aria-hidden />
        ) : isDone ? (
          <Check className="task-complete-btn__icon stroke-[3]" aria-hidden />
        ) : null}
      </button>
      <button
        type="button"
        className={cn(
          "home-ws-task-row__title",
          `home-ws-task-row__title--${bucket}`,
          isDone && "home-ws-task-row__title--done",
        )}
        onClick={(e) => {
          e.stopPropagation();
          void onOpen(item);
        }}
        aria-label={`${item.task.title}, ${BUCKET_ARIA_LABEL[bucket]}`}
      >
        {item.task.title}
      </button>
    </div>
  );
}