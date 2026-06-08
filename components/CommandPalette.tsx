"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import { 
  Search, Plus, CheckSquare, FileText, ListChecks, Users, Settings,
  Zap, ArrowRight, Briefcase, FilePlus, Hash, Filter, Sparkles, Download, GitBranch
} from "lucide-react";
import { useTaskStore } from "@/store/useTaskStore";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/utils";
import {
  buildTaskCompletionUndoContext,
  showTaskCompletionFeedback,
} from "@/features/tasks/lib/taskCompletionFeedback";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

// Small local VisuallyHidden component to satisfy Radix Dialog accessibility
// without adding new dependencies.
const VisuallyHidden = ({ children }: { children?: React.ReactNode }) => (
  <span
    style={{
      position: "absolute",
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0,
    }}
  >
    {children}
  </span>
);

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { 
    setView, 
    addTask, 
    addNote,
    addList,
    toggleCommandPalette,
    toggleKeyboardCheatsheet,
    tasks,
    notes,
    completeTask,
    undoTaskCompletion,
    currentView,
    currentWorkspace,
    workspaces,
    switchWorkspace,
    selectTask,
    setTaskFilter,
    recentActivity,
  } = useTaskStore();

  const runCommand = (action: () => void | Promise<void>) => {
    // Support both sync and async actions (e.g. addTask now returns Promise after hybrid wiring)
    const result = action();
    if (result instanceof Promise) {
      result.finally(() => onOpenChange(false));
    } else {
      onOpenChange(false);
    }
  };

  const handleCreateTask = async () => {
    const title = prompt("What needs to get done? (try natural language: 'Finish deck by Friday P1')");
    if (title) {
      const res = await addTask(title);
      if (!res) {
        toast.error("Failed to create task", { description: "Please try again." });
        return;
      }
      const task = res;
      toast.success(`Task created: ${task.title}`, {
        description: task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : undefined,
        action: {
          label: "View",
          onClick: () => {
            setView("tasks");
          },
        },
      });
    }
  };

  const handleCreateList = async () => {
    const title = prompt("List title? (e.g. 'Groceries')");
    if (title) {
      const res = await addList(title);
      if (!res) {
        toast.error("Failed to create list");
        return;
      }
      toast.success(`List created: ${res.title}`, {
        action: {
          label: "Go to Lists",
          onClick: () => setView("lists"),
        },
      });
      setView("lists");
    }
  };

  const handleCreateNote = async () => {
    const title = prompt("Note title? (e.g. 'Launch strategy Q3')");
    if (title) {
      const res = await addNote(title);
      if (!res) {
        toast.error("Failed to create note", { description: "Please try again." });
        return;
      }
      const note = res;
      toast.success(`Note created: ${note.title}`, {
        description: "Open Files view to review and edit records.",
        action: {
          label: "Go to Files",
          onClick: () => setView("notes"),
        },
      });
      setView("notes");
    }
  };

  // PWA Install action (persistent, works even without beforeinstallprompt event)
  const handlePWAInstall = () => {
    triggerHaptic('light');
    toast.info("Install Badazz Tasks", {
      description: "On mobile: browser Share → 'Add to Home Screen'. On Chrome/Android: may prompt native install. Gives offline shell, home screen icon, native feel.",
      action: {
        label: "Got it",
        onClick: () => {},
      },
    });
  };

  useScrollLock(open);

  // Agent 32: palette-local query for hybrid semantic (beyond cmdk fuzzy)
  const [paletteQuery, setPaletteQuery] = useState("");

  // Live recent (fallback) + NEW hybrid semantic pre-ranked results when typing
  const liveTasks = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10);

  const liveNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
    .slice(0, 6);

  const searchResults = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const taskHits = tasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((t) => ({ type: "task" as const, id: t.id, title: t.title }));
    const noteHits = notes
      .filter((n) => n.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map((n) => ({ type: "note" as const, id: n.id, title: n.title }));
    return [...taskHits, ...noteHits];
  }, [paletteQuery, tasks, notes]);

  const completeRandom = async () => {
    const incomplete = tasks.filter((t) => t.status !== "done");
    if (incomplete.length === 0) {
      toast.info("Everything is already done. Legend.");
      return;
    }
    const random = incomplete[Math.floor(Math.random() * incomplete.length)];
    const undoFallback = buildTaskCompletionUndoContext(
      random,
      workspaces.find((w) => w.id === random.workspaceId)?.name ?? currentWorkspace.name,
    );
    const result = await completeTask(random.id);
    if (result === "advanced") {
      showTaskCompletionFeedback("advanced", random, {
        undoTaskCompletion,
        undoFallback,
        advancedTask: useTaskStore.getState().tasks.find((t) => t.id === random.id) ?? random,
      });
    } else if (result === "completed") {
      showTaskCompletionFeedback("completed", random, {
        undoTaskCompletion,
        undoFallback,
      });
    } else {
      toast.info("Could not complete task", {
        description: "It may already be done or still syncing.",
      });
    }
  };

  // New power actions (live + context aware)
  const clearFilters = () => {
    setTaskFilter({ search: "", status: undefined, recurring: "incomplete" });
    toast("Filters cleared");
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      aria-label="Command Palette"
      className="cmdk-root fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onKeyDown={(e) => {
        if (e.key === "Escape") onOpenChange(false);
      }}
    >
      {/* Visually hidden title to satisfy Radix Dialog accessibility requirements */}
      <VisuallyHidden>
        Command Palette
      </VisuallyHidden>

      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={() => onOpenChange(false)} 
      />
      
      <div className="relative w-full max-w-[640px] mx-4 overflow-hidden rounded-2xl glass-strong shadow-2xl">
        <Command className="border-none bg-transparent">
          <div className="flex items-center border-b border-white/10 px-4">
            <Search className="mr-3 h-4 w-4 text-[#c084fc]" />
            <Command.Input 
              placeholder="Search tasks, notes, or commands…"
              className="cmdk-input flex-1 py-4 text-[15px] placeholder:text-[#71717a] outline-none" 
              value={paletteQuery}
              onValueChange={setPaletteQuery}
            />
            <div className="text-[10px] text-[#71717a] font-mono px-2 py-0.5 rounded bg-white/5">ESC</div>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-2 text-sm">
            <Command.Empty className="py-8 text-center text-[#71717a]">
              No matches. Try create or a task title.
            </Command.Empty>

            {/* Quick Actions - core power moves + new Phase 2 power */}
            <Command.Group heading="Quick Actions" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#71717a] uppercase">
              <Command.Item 
                onSelect={() => runCommand(handleCreateTask)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Plus className="h-4 w-4 text-[#c084fc]" />
                <div className="flex-1">
                  <div>Create new task</div>
                  <div className="text-xs text-[#71717a]">Adds a new task to this workspace</div>
                </div>
                <div className="text-xs text-[#c084fc] font-mono">⌘N</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(handleCreateNote)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <FilePlus className="h-4 w-4 text-[#c084fc]" />
                <div className="flex-1">
                  <div>Create new note</div>
                  <div className="text-xs text-[#71717a]">Instant capture for your second brain</div>
                </div>
                <div className="text-xs text-[#c084fc] font-mono">⌘⇧N</div>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(handleCreateList)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <ListChecks className="h-4 w-4 text-[#c084fc]" />
                <div className="flex-1">
                  <div>Create new list</div>
                  <div className="text-xs text-[#71717a]">Quick checklist like Google Keep</div>
                </div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(completeRandom)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <CheckSquare className="h-4 w-4 text-[#c084fc]" />
                <div>Complete a random task</div>
                <div className="ml-auto text-[10px] text-[#71717a] font-mono">lucky</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(clearFilters)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Filter className="h-4 w-4 text-[#c084fc]" />
                <div>Clear all task filters</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(() => {
                  toggleKeyboardCheatsheet(true);
                })}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Hash className="h-4 w-4 text-[#c084fc]" />
                <div>Show full keyboard cheatsheet</div>
                <div className="ml-auto text-xs text-[#c084fc] font-mono">?</div>
              </Command.Item>
            </Command.Group>

            {/* Workspaces - switch instantly (new powerful command) */}
            <Command.Group heading="Switch Workspace" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#71717a] uppercase mt-2">
              {workspaces.map((ws) => (
                <Command.Item
                  key={ws.id}
                  onSelect={() => runCommand(() => {
                    switchWorkspace(ws.id);
                    toast.info(`Switched to ${ws.name}`);
                  })}
                  className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
                >
                  <Briefcase className="h-4 w-4" />
                  <span>{ws.name}</span>
                  {currentWorkspace.id === ws.id && <div className="ml-auto text-[10px] text-[#c084fc]">current</div>}
                </Command.Item>
              ))}
              <Command.Item
                onSelect={() => runCommand(() => {
                  toast("Create workspace coming in full multi-user phase");
                })}
                className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5 text-[#71717a]"
              >
                <Plus className="h-4 w-4" />
                <span>Create new workspace...</span>
              </Command.Item>
            </Command.Group>

            {/* Navigation - all views + current indicator */}
            <Command.Group heading="Navigate Views" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#71717a] uppercase mt-2">
              {[
                { label: "All Tasks", view: "tasks" as const, icon: CheckSquare, shortcut: "1" },
                { label: "Files", view: "notes" as const, icon: FileText, shortcut: "2" },
                { label: "Lists", view: "lists" as const, icon: ListChecks, shortcut: "3" },
                { label: "Team", view: "teams" as const, icon: Users, shortcut: "4" },
                { label: "Workspace Settings", view: "settings" as const, icon: Settings, shortcut: "5" },
              ].map((item) => (
                <Command.Item
                  key={item.view}
                  onSelect={() => runCommand(() => setView(item.view))}
                  className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {currentView === item.view && <div className="ml-auto text-[10px] text-[#c084fc]">current</div>}
                  <div className="ml-2 text-[10px] text-[#71717a] font-mono">{item.shortcut}</div>
                </Command.Item>
              ))}
            </Command.Group>

            {searchResults.length > 0 && (
              <Command.Group heading="Search" className="px-2 py-1.5 text-[10px] font-semibold text-[#71717a] uppercase mt-2">
                {searchResults.map((r) => (
                  <Command.Item
                    key={`${r.type}-${r.id}`}
                    onSelect={() => runCommand(() => {
                      if (r.type === "task") {
                        setView("tasks");
                        selectTask(r.id);
                      } else {
                        setView("notes");
                      }
                    })}
                    className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
                    value={`${r.type} ${r.title}`}
                  >
                    {r.type === "task" ? (
                      <CheckSquare className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 truncate">{r.title}</div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* LIVE searchable results over REAL tasks (cmdk fuzzy filters these live as you type — huge power upgrade) */}
            {liveTasks.length > 0 && (
              <Command.Group heading="Jump to / Act on Task (live search)" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#71717a] uppercase mt-2">
                {liveTasks.map((task) => (
                  <Command.Item
                    key={task.id}
                    onSelect={() => runCommand(() => {
                      setView("tasks");
                      selectTask(task.id);
                      toast.info("Task selected", { description: task.title });
                    })}
                    className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
                    value={`task ${task.title} ${task.status} ${task.assignee || ""}`}
                  >
                    <CheckSquare className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0 truncate">{task.title}</div>
                    <div className="text-[10px] text-[#71717a] font-mono shrink-0 capitalize">{task.status}</div>
                  </Command.Item>
                ))}
                <div className="px-3 py-1 text-[9px] text-[#a1a1aa]">Type to filter live across open tasks • Enter to jump + select</div>
              </Command.Group>
            )}

            {/* LIVE searchable results over REAL notes */}
            {liveNotes.length > 0 && (
              <Command.Group heading="Jump to Note (live search)" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#71717a] uppercase mt-2">
                {liveNotes.map((note) => (
                  <Command.Item
                    key={note.id}
                    onSelect={() => runCommand(() => {
                      setView("notes");
                      toast.info("Note selected", { description: note.title });
                    })}
                    className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
                    value={`note ${note.title} ${note.tags?.join(" ") || ""}`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0 truncate">{note.title}</div>
                    <div className="text-[10px] text-[#71717a] font-mono shrink-0">note</div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Keyboard Shortcuts - fully documented inside palette for discoverability */}
            <Command.Group heading="Keyboard Shortcuts" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#71717a] uppercase mt-2">
              <Command.Item 
                onSelect={() => runCommand(() => toggleKeyboardCheatsheet(true))}
                className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Hash className="h-4 w-4" />
                <span>View complete cheatsheet (all keys)</span>
                <div className="ml-auto text-xs text-[#c084fc] font-mono">?</div>
              </Command.Item>
              <div className="px-3 pt-1 pb-2 text-[11px] text-[#a1a1aa] leading-snug">
                Global: ⌘K palette • ⌘N quick task • 1-5 switch views • ? cheatsheet • Space complete • ESC close
              </div>
              <div className="px-3 pb-1 text-[11px] text-[#a1a1aa] leading-snug">
                Inside palette: ↑↓ navigate • Enter run • Type to live fuzzy-search tasks/notes + power actions
              </div>
            </Command.Group>

            <div className="px-3 py-2 text-[11px] text-[#71717a] flex items-center justify-between border-t border-white/10 mt-2 pt-3">
              <div>Type a task or note name to jump there quickly</div>
              <div className="text-[#c084fc] flex items-center gap-1">Badazz Tasks <ArrowRight className="h-3 w-3" /></div>
            </div>

            {/* PWA Install — persistent access for home screen + offline native feel (Agent 27 polish) */}
            <Command.Group heading="PWA & Install" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#71717a] uppercase mt-2">
              <Command.Item 
                onSelect={() => runCommand(handlePWAInstall)}
                className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Download className="h-4 w-4 text-[#00ff9f]" />
                <div>Install / Add to Home Screen</div>
                <div className="ml-auto text-xs text-[#00ff9f] font-mono">PWA</div>
              </Command.Item>
              <div className="px-3 pt-1 pb-2 text-[11px] text-[#a1a1aa] leading-snug">
                Works offline, home icon, full screen. Use on phones for premium native task app feel.
              </div>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </Command.Dialog>
  );
}
