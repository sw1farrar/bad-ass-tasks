"use client";

import React, { useMemo } from "react";
import type { WorkspaceMember } from "@/types";
import type { HomeFocusItem } from "../lib/buildAttentionItems";
import type { WorkspaceDueTaskGroups } from "../lib/groupWorkspaceDueTasks";
import {
  HOME_TILE_COLUMN_ROWS,
  HOME_TILE_TASK_SLOTS,
  pickHomeTileTasks,
  type HomeTileTask,
} from "../lib/pickHomeTileTasks";
import { pickHomeTileTaskSections } from "../lib/pickHomeTileTaskSections";
import { HomeWorkspaceTaskRow } from "./HomeWorkspaceTaskRow";

interface HomeWorkspaceTaskPanelProps {
  groups: WorkspaceDueTaskGroups;
  taskLoadingStates?: Record<string, boolean>;
  onCompleteTask: (item: HomeFocusItem) => void | Promise<void>;
  onOpenTask: (item: HomeFocusItem) => void | Promise<void>;
  useAssigneeSections?: boolean;
  members?: WorkspaceMember[];
  currentUserId?: string;
}

function TaskRows({
  tasks,
  maxSlots,
  taskLoadingStates,
  onCompleteTask,
  onOpenTask,
  listClassName,
}: {
  tasks: HomeTileTask[];
  maxSlots: number;
  taskLoadingStates?: Record<string, boolean>;
  onCompleteTask: (item: HomeFocusItem) => void | Promise<void>;
  onOpenTask: (item: HomeFocusItem) => void | Promise<void>;
  listClassName: string;
}) {
  const emptySlots = maxSlots - tasks.length;

  return (
    <div className={listClassName}>
      {tasks.map(({ item, bucket }) => (
        <HomeWorkspaceTaskRow
          key={item.task.id}
          item={item}
          bucket={bucket}
          isLoading={!!taskLoadingStates?.[item.task.id]}
          onComplete={onCompleteTask}
          onOpen={onOpenTask}
        />
      ))}
      {Array.from({ length: emptySlots }, (_, i) => (
        <div
          key={`empty-${i}`}
          className="home-ws-task-row home-ws-task-row--empty"
          aria-hidden
        />
      ))}
    </div>
  );
}

export function HomeWorkspaceTaskPanel({
  groups,
  taskLoadingStates,
  onCompleteTask,
  onOpenTask,
  useAssigneeSections = false,
  members = [],
  currentUserId,
}: HomeWorkspaceTaskPanelProps) {
  const sections = useMemo(
    () =>
      useAssigneeSections
        ? pickHomeTileTaskSections(groups, members, currentUserId)
        : [],
    [groups, members, currentUserId, useAssigneeSections],
  );

  const flatTasks = useMemo(
    () => (useAssigneeSections ? [] : pickHomeTileTasks(groups)),
    [groups, useAssigneeSections],
  );

  if (useAssigneeSections && sections.length > 0) {
    const meSection = sections.find((section) => section.key === "me");
    const allSection = sections.find((section) => section.key === "all");

    return (
      <div className="home-ws-card__tasks" data-no-activate role="list" aria-label="Due tasks">
        <div
          className="home-ws-card__task-columns"
          data-has-me={meSection ? "true" : "false"}
          data-has-all={allSection ? "true" : "false"}
        >
          {meSection ? (
            <section
              className="home-ws-card__task-column home-ws-card__task-column--me"
              aria-label={`${meSection.label} due tasks`}
            >
              <h4 className="home-ws-card__task-section-label">{meSection.label}</h4>
              <TaskRows
                tasks={meSection.tasks}
                maxSlots={HOME_TILE_COLUMN_ROWS}
                taskLoadingStates={taskLoadingStates}
                onCompleteTask={onCompleteTask}
                onOpenTask={onOpenTask}
                listClassName="home-ws-card__task-column-list"
              />
            </section>
          ) : null}
          {allSection ? (
            <section
              className="home-ws-card__task-column home-ws-card__task-column--all"
              aria-label={`${allSection.label} due tasks`}
            >
              <h4 className="home-ws-card__task-section-label">{allSection.label}</h4>
              <TaskRows
                tasks={allSection.tasks}
                maxSlots={HOME_TILE_COLUMN_ROWS}
                taskLoadingStates={taskLoadingStates}
                onCompleteTask={onCompleteTask}
                onOpenTask={onOpenTask}
                listClassName="home-ws-card__task-column-list"
              />
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="home-ws-card__tasks" data-no-activate role="list" aria-label="Due tasks">
      <TaskRows
        tasks={flatTasks}
        maxSlots={HOME_TILE_TASK_SLOTS}
        taskLoadingStates={taskLoadingStates}
        onCompleteTask={onCompleteTask}
        onOpenTask={onOpenTask}
        listClassName="home-ws-card__tasks-grid"
      />
    </div>
  );
}