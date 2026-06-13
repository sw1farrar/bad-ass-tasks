"use client";

import React from "react";
import { WorkspaceOpenTasksGraphic } from "./WorkspaceOpenTasksGraphic";
import { HomeWorkspaceVitalsStrip } from "./HomeWorkspaceVitalsStrip";

interface HomeWorkspaceTileHeaderProps {
  name: string;
  openTasks: number;
  overdue: number;
  dueToday: number;
  listCount: number;
  pendingReviewCount: number;
  onTasksClick?: () => void;
  onListsClick?: () => void;
  onReviewClick?: () => void;
}

/** Ring left; name + vitals stacked right, capped to ring height. */
export function HomeWorkspaceTileHeader({
  name,
  openTasks,
  overdue,
  dueToday,
  listCount,
  pendingReviewCount,
  onTasksClick,
  onListsClick,
  onReviewClick,
}: HomeWorkspaceTileHeaderProps) {
  return (
    <div className="home-ws-card__head flex items-center gap-2.5 md:gap-3 min-w-0 pr-12 md:pr-16 shrink-0">
      <WorkspaceOpenTasksGraphic
        openTasks={openTasks}
        overdue={overdue}
        dueToday={dueToday}
        size={56}
        showSublabel={false}
        className="home-ws-card__ring md:hidden shrink-0"
      />
      <WorkspaceOpenTasksGraphic
        openTasks={openTasks}
        overdue={overdue}
        dueToday={dueToday}
        size={72}
        showSublabel={false}
        className="home-ws-card__ring hidden md:block shrink-0"
      />
      <div className="home-ws-card__head-copy min-w-0 flex-1">
        <div className="home-ws-card__name font-semibold leading-tight break-words line-clamp-1 md:line-clamp-2">
          {name}
        </div>
        <div data-no-activate>
          <HomeWorkspaceVitalsStrip
            className="home-ws-vitals--head"
            openTasks={openTasks}
            overdue={overdue}
            listCount={listCount}
            pendingReviewCount={pendingReviewCount}
            onTasksClick={onTasksClick}
            onListsClick={onListsClick}
            onReviewClick={onReviewClick}
          />
        </div>
      </div>
    </div>
  );
}