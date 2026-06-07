"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Task } from "@/types";

interface TodayViewProps {
  todayTasks: Task[];
  activeTaskCount: number;
  setView: (view: "today" | "tasks" | "notes" | "teams") => void;
  renderTaskRow: (task: Task) => React.ReactNode;
}

export function TodayView({
  todayTasks,
  activeTaskCount,
  setView,
  renderTaskRow,
}: TodayViewProps) {
  return (
    <div className="max-w-4xl mx-auto pt-4 md:pt-8">
      <div className="mb-4 md:mb-8">
        <div className="text-3xl md:text-5xl font-semibold tracking-tight">Today</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="glass rounded-3xl p-6">
          <div className="text-[#71717a] text-sm">Due today or overdue</div>
          <div className="text-6xl font-semibold tabular-nums mt-2 text-[#ff3366]">
            {todayTasks.length}
          </div>
        </div>
        <div className="glass rounded-3xl p-6">
          <div className="text-[#71717a] text-sm">Active tasks</div>
          <div className="text-6xl font-semibold tabular-nums mt-2">{activeTaskCount}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-lg">Due now</div>
        <button
          onClick={() => setView("tasks")}
          className="text-xs text-[#c084fc] flex items-center gap-1 hover:underline"
        >
          All tasks <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-1">
        {todayTasks.length > 0 ? (
          todayTasks.map(renderTaskRow)
        ) : (
          <div className="text-center py-12 text-[#71717a] text-sm">Nothing due today.</div>
        )}
      </div>
    </div>
  );
}