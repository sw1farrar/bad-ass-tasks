"use client";

import React, { useState, useMemo } from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { 
  Search, Plus, CheckSquare, FileText, ListChecks, Users, Settings,
  ArrowRight, Briefcase, FilePlus, Hash, Filter, Download, FolderOpen, Notebook, HeartPulse, Calendar,
} from "lucide-react";
import { getBottomNavViews } from "@/lib/nav/workspaceViews";
import { searchNotesLocal } from "@/lib/files/searchNotesLocal";
import { filterPendingReview } from "@/lib/files/fileFilters";
import { useTaskStore } from "@/store/useTaskStore";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/utils";
import {
  buildTaskCompletionUndoContext,
  showTaskCompletionFeedback,
} from "@/features/tasks/lib/taskCompletionFeedback";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open the task detail modal (same as clicking a table row). */
  onOpenTask?: (task: { id: string; title: string; notebookId?: string | null }) => void;
}

export function CommandPalette({ open, onOpenChange, onOpenTask }: CommandPaletteProps) {
  const { 
    setView, 
    addTask, 
    addList,
    toggleKeyboardCheatsheet,
    tasks,
    notes,
    completeTask,
    undoTaskCompletion,
    triggerCelebration,
    currentView,
    currentWorkspace,
    workspaces,
    switchWorkspace,
    selectTask,
    setTaskFilter,
    setFilesOpenReview,
    setFilesSelectNoteId,
    setFilesCaptureOpen,
    setSelectedNoteId,
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

  const handleCaptureFile = () => {
    setSelectedNoteId(null);
    setFilesCaptureOpen(true);
    setView("notes");
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

  const pendingReviewCount = useMemo(
    () => filterPendingReview(notes).length,
    [notes],
  );

  const searchResults = useMemo(() => {
    const q = paletteQuery.trim();
    if (q.length < 2) return [];
    const taskHits = tasks
      .filter((t) => t.title.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 6)
      .map((t) => ({ type: "task" as const, id: t.id, title: t.title, subtitle: undefined as string | undefined }));
    const noteHits = searchNotesLocal(notes, q, 6).map((n) => {
      const tagLine = (n.tags ?? []).filter((t) => t !== "from-email").slice(0, 3).join(", ");
      const memoSnippet = (n.memo ?? n.searchPlain ?? "").trim().slice(0, 60);
      const subtitle = [tagLine, memoSnippet].filter(Boolean).join(" · ") || undefined;
      return { type: "file" as const, id: n.id, title: n.title || "Untitled", subtitle };
    });
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
        triggerCelebration,
        advancedTask: useTaskStore.getState().tasks.find((t) => t.id === random.id) ?? random,
      });
    } else if (result === "completed") {
      showTaskCompletionFeedback("completed", random, {
        undoTaskCompletion,
        undoFallback,
        triggerCelebration,
      });
    } else {
      toast.info("Could not complete task", {
        description: "It may already be done or still syncing.",
      });
    }
  };

  // New power actions (live + context aware)
  const clearFilters = () => {
    setTaskFilter({
      search: "",
      status: undefined,
      statusMode: "incomplete",
      recurrenceMode: "all",
      starred: "all",
      folderFilter: "all",
    });
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
      <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
      <Dialog.Description className="sr-only">
        Search commands, tasks, notes, and workspace actions
      </Dialog.Description>

      <div 
        className="fixed inset-0 overlay-scrim backdrop-blur-sm" 
        onClick={() => onOpenChange(false)} 
      />
      
      <div className="command-palette-panel relative w-full max-w-[640px] mx-4 overflow-hidden rounded-2xl glass-strong modal-panel shadow-2xl">
        <Command className="border-none bg-transparent">
          <div className="flex items-center border-b border-border-glass px-4">
            <Search className="mr-3 h-4 w-4 text-neon-purple" />
            <Command.Input 
              placeholder="Search tasks, notes, or commands…"
              className="cmdk-input flex-1 py-4 text-[15px] placeholder:text-text-muted outline-none" 
              value={paletteQuery}
              onValueChange={setPaletteQuery}
            />
            <div className="text-[10px] text-text-muted font-mono px-2 py-0.5 rounded bg-surface-hover">ESC</div>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-2 text-sm">
            <Command.Empty className="py-8 text-center text-text-muted">
              No matches. Try create or a task title.
            </Command.Empty>

            {/* Quick Actions - core power moves + new Phase 2 power */}
            <Command.Group heading="Quick Actions" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase">
              <Command.Item 
                onSelect={() => runCommand(handleCreateTask)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <Plus className="h-4 w-4 text-neon-purple" />
                <div className="flex-1">
                  <div>Create new task</div>
                  <div className="text-xs text-text-muted">Adds a new task to this workspace</div>
                </div>
                <div className="text-xs text-neon-purple font-mono">⌘N</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(handleCaptureFile)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <FilePlus className="h-4 w-4 text-neon-purple" />
                <div className="flex-1">
                  <div>Capture file</div>
                  <div className="text-xs text-text-muted">Tags, notes, images & attachments in one modal</div>
                </div>
                <div className="text-xs text-neon-purple font-mono">⌘⇧N</div>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(handleCreateList)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <ListChecks className="h-4 w-4 text-neon-purple" />
                <div className="flex-1">
                  <div>Create new list</div>
                  <div className="text-xs text-text-muted">Quick checklist like Google Keep</div>
                </div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(completeRandom)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <CheckSquare className="h-4 w-4 text-neon-purple" />
                <div>Complete a random task</div>
                <div className="ml-auto text-[10px] text-text-muted font-mono">lucky</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(clearFilters)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <Filter className="h-4 w-4 text-neon-purple" />
                <div>Clear all task filters</div>
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    setFilesOpenReview(true);
                    setView("notes");
                    if (pendingReviewCount > 0) {
                      toast.info("Files Review", {
                        description: `${pendingReviewCount} file${pendingReviewCount === 1 ? "" : "s"} awaiting approval`,
                      });
                    } else {
                      toast.info("Review is clear");
                    }
                  })
                }
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <FolderOpen className="h-4 w-4 text-neon-purple" />
                <div className="flex-1">
                  <div>Open Files Review</div>
                  <div className="text-xs text-text-muted">
                    {pendingReviewCount > 0
                      ? `${pendingReviewCount} pending`
                      : "No files awaiting approval"}
                  </div>
                </div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(() => {
                  toggleKeyboardCheatsheet(true);
                })}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <Hash className="h-4 w-4 text-neon-purple" />
                <div>Show full keyboard cheatsheet</div>
                <div className="ml-auto text-xs text-neon-purple font-mono">?</div>
              </Command.Item>
            </Command.Group>

            {/* Workspaces - switch instantly (new powerful command) */}
            <Command.Group heading="Switch Workspace" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase mt-2">
              {workspaces.map((ws) => (
                <Command.Item
                  key={ws.id}
                  onSelect={() => runCommand(() => {
                    switchWorkspace(ws.id);
                    toast.info(`Switched to ${ws.name}`);
                  })}
                  className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
                >
                  <Briefcase className="h-4 w-4" />
                  <span>{ws.name}</span>
                  {currentWorkspace.id === ws.id && <div className="ml-auto text-[10px] text-neon-purple">current</div>}
                </Command.Item>
              ))}
              <Command.Item
                onSelect={() => runCommand(() => {
                  toast("Create workspace coming in full multi-user phase");
                })}
                className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover text-text-muted"
              >
                <Plus className="h-4 w-4" />
                <span>Create new workspace...</span>
              </Command.Item>
            </Command.Group>

            {/* Navigation - all views + current indicator */}
            <Command.Group heading="Navigate Views" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase mt-2">
              {getBottomNavViews(currentWorkspace)
                .filter((v) => v.id !== "home")
                .map((v, index) => ({
                  label: v.id === "notes" ? "Files" : v.label,
                  view: v.id,
                  icon:
                    v.id === "tasks"
                      ? CheckSquare
                      : v.id === "notes"
                        ? FileText
                        : v.id === "notebooks"
                          ? Notebook
                          : v.id === "meetings"
                            ? Calendar
                          : v.id === "lists"
                            ? ListChecks
                            : v.id === "health"
                              ? HeartPulse
                            : v.id === "teams"
                              ? Users
                              : Settings,
                  shortcut: String(index + 1),
                }))
                .map((item) => (
                <Command.Item
                  key={item.view}
                  onSelect={() => runCommand(() => setView(item.view))}
                  className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {currentView === item.view && <div className="ml-auto text-[10px] text-neon-purple">current</div>}
                  <div className="ml-2 text-[10px] text-text-muted font-mono">{item.shortcut}</div>
                </Command.Item>
              ))}
            </Command.Group>

            {searchResults.length > 0 && (
              <Command.Group heading="Search" className="px-2 py-1.5 text-[10px] font-semibold text-text-muted uppercase mt-2">
                {searchResults.map((r) => (
                  <Command.Item
                    key={`${r.type}-${r.id}`}
                    onSelect={() => runCommand(() => {
                      if (r.type === "task") {
                        setView("tasks");
                        selectTask(r.id);
                      } else {
                        setFilesSelectNoteId(r.id);
                        setView("notes");
                        toast.info("File selected", { description: r.title });
                      }
                    })}
                    className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
                    value={`${r.type} ${r.title} ${r.subtitle ?? ""}`}
                  >
                    {r.type === "task" ? (
                      <CheckSquare className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{r.title}</div>
                      {r.subtitle && (
                        <div className="text-[10px] text-text-muted truncate">{r.subtitle}</div>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* LIVE searchable results over REAL tasks (cmdk fuzzy filters these live as you type — huge power upgrade) */}
            {liveTasks.length > 0 && (
              <Command.Group heading="Jump to / Act on Task (live search)" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase mt-2">
                {liveTasks.map((task) => (
                  <Command.Item
                    key={task.id}
                    onSelect={() => runCommand(() => {
                      setView("tasks");
                      if (onOpenTask) {
                        onOpenTask(task);
                      } else {
                        selectTask(task.id);
                        toast.info("Task selected", { description: task.title });
                      }
                    })}
                    className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
                    value={`task ${task.title} ${task.status} ${task.assignee || ""}`}
                  >
                    <CheckSquare className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0 truncate">{task.title}</div>
                    <div className="text-[10px] text-text-muted font-mono shrink-0 capitalize">{task.status}</div>
                  </Command.Item>
                ))}
                <div className="px-3 py-1 text-[9px] text-text-secondary">Type to filter live across open tasks • Enter to open</div>
              </Command.Group>
            )}

            {/* LIVE searchable results over REAL notes */}
            {liveNotes.length > 0 && (
              <Command.Group heading="Jump to Note (live search)" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase mt-2">
                {liveNotes.map((note) => (
                  <Command.Item
                    key={note.id}
                    onSelect={() => runCommand(() => {
                      setFilesSelectNoteId(note.id);
                      setView("notes");
                      toast.info("File selected", { description: note.title });
                    })}
                    className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
                    value={`note ${note.title} ${note.tags?.join(" ") || ""}`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0 truncate">{note.title}</div>
                    <div className="text-[10px] text-text-muted font-mono shrink-0">note</div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Keyboard Shortcuts - fully documented inside palette for discoverability */}
            <Command.Group heading="Keyboard Shortcuts" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase mt-2">
              <Command.Item 
                onSelect={() => runCommand(() => toggleKeyboardCheatsheet(true))}
                className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <Hash className="h-4 w-4" />
                <span>View complete cheatsheet (all keys)</span>
                <div className="ml-auto text-xs text-neon-purple font-mono">?</div>
              </Command.Item>
              <div className="px-3 pt-1 pb-2 text-[11px] text-text-secondary leading-snug">
                Global: ⌘K palette • ⌘N quick task • ⌘⇧N capture file • 1-5 switch views • ? cheatsheet • ESC close
              </div>
              <div className="px-3 pb-1 text-[11px] text-text-secondary leading-snug">
                Inside palette: ↑↓ navigate • Enter run • Type to live fuzzy-search tasks/notes + power actions
              </div>
            </Command.Group>

            <div className="px-3 py-2 text-[11px] text-text-muted flex items-center justify-between border-t border-border-glass mt-2 pt-3">
              <div>Type a task or note name to jump there quickly</div>
              <div className="text-neon-purple flex items-center gap-1">Badazz Tasks <ArrowRight className="h-3 w-3" /></div>
            </div>

            {/* PWA Install — persistent access for home screen + offline native feel (Agent 27 polish) */}
            <Command.Group heading="PWA & Install" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase mt-2">
              <Command.Item 
                onSelect={() => runCommand(handlePWAInstall)}
                className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-surface-hover"
              >
                <Download className="h-4 w-4 text-neon-green" />
                <div>Install / Add to Home Screen</div>
                <div className="ml-auto text-xs text-neon-green font-mono">PWA</div>
              </Command.Item>
              <div className="px-3 pt-1 pb-2 text-[11px] text-text-secondary leading-snug">
                Works offline, home icon, full screen. Use on phones for premium native task app feel.
              </div>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </Command.Dialog>
  );
}
