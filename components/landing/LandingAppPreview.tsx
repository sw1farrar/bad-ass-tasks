"use client";

import {
  Check,
  Clock,
  Home,
  MessageCircle,
  Settings,
  Star,
  Users,
  Bell,
  User,
  Command,
} from "lucide-react";
import { TaskRow } from "@/features/tasks/components/TaskRow";
import { formatDueDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { LANDING_TASKS, LANDING_WORKSPACE } from "./landingSampleData";

const SIDEBAR_VIEWS: Array<{
  id: string;
  label: string;
  icon: typeof Clock;
  active?: boolean;
}> = [
  { id: "today", label: "Today", icon: Clock, active: true },
  { id: "tasks", label: "Tasks", icon: Check },
  { id: "notes", label: "Notes", icon: Star },
  { id: "teams", label: "Team", icon: Users },
  { id: "settings", label: "Workspace Settings", icon: Settings },
];

const noop = () => {};

export function LandingAppPreview() {
  return (
    <div
      className="relative w-full max-w-[640px] mx-auto lg:mx-0 lg:ml-auto"
      aria-hidden
    >
      <div className="absolute -inset-6 rounded-[2rem] bg-[#c084fc]/20 blur-3xl opacity-40 pointer-events-none" />
      <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden ring-1 ring-[#c084fc]/20">
        {/* Top bar — matches app/page.tsx */}
        <div className="h-12 border-b border-white/10 flex items-center px-4 justify-between bg-[#0a0a0f]/95 backdrop-blur-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center shrink-0">
              <Check className="h-4 w-4 text-black" />
            </div>
            <span className="font-semibold text-sm tracking-tight truncate">Badazz Tasks</span>
            <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-[#c084fc] border border-white/10 font-mono">
              {LANDING_WORKSPACE.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-[#71717a]">
              <Bell className="h-3.5 w-3.5" />
            </div>
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center text-[10px] font-bold text-black">
              Y
            </div>
          </div>
        </div>

        <div className="flex min-h-[340px]">
          {/* Sidebar */}
          <aside className="hidden sm:flex w-44 shrink-0 flex-col pt-3 px-2 border-r border-white/10 bg-[#0a0a0f]">
            <div className="sidebar-item active mb-1 mx-0.5 pointer-events-none">
              <Home className="h-4 w-4" />
              Home
            </div>
            <div className="px-2 mb-3 mt-1">
              <div className="text-[10px] text-[#71717a] font-medium tracking-widest mb-1">WORKSPACE</div>
              <div className="text-sm font-semibold tracking-tight truncate">{LANDING_WORKSPACE.name}</div>
            </div>
            <div className="space-y-0.5 px-0.5">
              {SIDEBAR_VIEWS.map(({ id, label, icon: Icon, active }) => (
                <div
                  key={id}
                  className={cn("sidebar-item pointer-events-none", active && "active")}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate text-[13px]">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto p-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-[#71717a] flex items-center gap-2">
                <Command className="h-3 w-3 text-[#c084fc]" />
                <span>⌘K command palette</span>
              </div>
            </div>
          </aside>

          {/* Main — Today view */}
          <main className="flex-1 min-w-0 p-4 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Today</h3>
                <p className="text-xs text-[#71717a] mt-0.5">4 tasks · 2 due soon</p>
              </div>
              <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-[#c084fc]">
                <MessageCircle className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="space-y-1 pointer-events-none select-none">
              {LANDING_TASKS.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isDone={task.status === "done"}
                  isOpLoading={false}
                  due={formatDueDate(task.dueDate)}
                  onOpen={noop}
                  onComplete={noop}
                />
              ))}
            </div>
          </main>
        </div>
      </div>

      {/* Floating accent — command hint */}
      <div className="absolute -left-4 sm:-left-8 bottom-8 hidden md:flex items-center gap-2 rounded-xl border border-[#c084fc]/30 bg-[#111114]/90 backdrop-blur-md px-3 py-2 shadow-lg">
        <div className="h-6 w-6 rounded-md bg-[#c084fc]/15 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-[#c084fc]" />
        </div>
        <div className="text-xs">
          <div className="text-[#f4f4f5] font-medium">Live workspace</div>
          <div className="text-[#71717a]">Real app UI, not a mockup</div>
        </div>
      </div>
    </div>
  );
}