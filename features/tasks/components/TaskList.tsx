"use client";

import React from "react";

interface TaskListProps {
  filteredTasks: any[];
  renderTaskRow: (task: any) => React.ReactNode;
}

/**
 * TaskList
 *
 * Extracted from the monolithic app/page.tsx as part of M0 architecture resumption (Batch 2.6).
 *
 * Thin presentational wrapper for the list-mode rendering of tasks.
 * Currently just wraps the map over renderTaskRow + empty state.
 *
 * Guard note: renderTaskRow (which contains heavy swipe/gesture/complete logic)
 * and all store mutations remain in the parent for this batch.
 * This component is intentionally kept minimal to allow safe, incremental progress.
 *
 * Future batches can evolve this into a richer TaskList with virtualization,
 * bulk actions, etc., while keeping guards in the orchestrator.
 */
export function TaskList({ filteredTasks, renderTaskRow }: TaskListProps) {
  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-8 md:py-16 text-[#71717a] text-sm">
        No tasks match your filters.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {filteredTasks.map((task) => (
        <React.Fragment key={task.id}>
          {renderTaskRow(task)}
        </React.Fragment>
      ))}
    </div>
  );
}
