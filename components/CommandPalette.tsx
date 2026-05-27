"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import { 
  Search, Plus, Calendar, CheckSquare, FileText, Users, 
  Zap, ArrowRight, Clock, Briefcase, FilePlus, Hash, Filter, Target, Sparkles, Download, GitBranch
} from "lucide-react";
import { useTaskStore } from "@/store/useTaskStore";
import { toast } from "sonner";
import { 
  generateDailyBriefing, generateDailyBriefingAI, extractActionItemsFromText, extractActionItemsFromTextAI, 
  triggerHaptic, generateWeeklyBriefing, isXAIConfigured, getHybridSearchResults 
} from "@/lib/utils";

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
    toggleCommandPalette,
    toggleKeyboardCheatsheet,
    tasks,
    notes,
    completeTask,
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
        description: "Open Notes view to edit (full editor coming soon).",
        action: {
          label: "Go to Notes",
          onClick: () => setView("notes"),
        },
      });
      setView("notes");
    }
  };

  // PWA Install action (persistent, works even without beforeinstallprompt event)
  const handlePWAInstall = () => {
    triggerHaptic('light');
    toast.info("Install Bad Ass Tasks", {
      description: "On mobile: browser Share → 'Add to Home Screen'. On Chrome/Android: may prompt native install. Gives offline shell, home screen icon, native feel.",
      action: {
        label: "Got it",
        onClick: () => {},
      },
    });
  };

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

  const semanticResults = useMemo(() => {
    if (paletteQuery.trim().length < 2) return [];
    return getHybridSearchResults(paletteQuery, { tasks, notes }, { limit: 9, minScore: 12 });
  }, [paletteQuery, tasks, notes]);

  const completeRandom = async () => {
    const incomplete = tasks.filter(t => t.status !== "done");
    if (incomplete.length === 0) {
      toast.info("Everything is already done. Legend.");
      return;
    }
    const random = incomplete[Math.floor(Math.random() * incomplete.length)];
    await completeTask(random.id);
    toast.success(`Completed: ${random.title}`, {
      description: "Nice work. What's next?",
    });
  };

  // New power actions (live + context aware)
  const focusP0s = () => {
    setTaskFilter({ priority: ["P0"] });
    setView("tasks");
    toast.success("Focused on P0s", { description: "High-priority tasks only. Clear filter anytime." });
  };

  const openAIFromPalette = () => {
    // Palette closes automatically via runCommand. Real open is in page (floating button).
    // This surfaces the action powerfully in the command center.
    toast("AI Assistant ready", {
      description: "Click the floating ✨ AI button (bottom-right) or type in chat. Full inline AI coming Phase 7.",
    });
    setView("tasks"); // keep context
  };

  const goToKanban = () => {
    setView("tasks");
    toast.info("Tasks view — toggle Board in the header for full drag-and-drop Kanban", {
      description: "Buttery @dnd-kit powered. Drag between columns or reorder.",
    });
  };

  const clearFilters = () => {
    setTaskFilter({ search: "", priority: undefined, status: undefined });
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
              placeholder="Type command, task, note, or view... (fuzzy + hybrid semantic when typing)" 
              className="cmdk-input flex-1 py-4 text-[15px] placeholder:text-[#71717a] outline-none" 
              value={paletteQuery}
              onValueChange={setPaletteQuery}
            />
            <div className="text-[10px] text-[#71717a] font-mono px-2 py-0.5 rounded bg-white/5">ESC</div>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-2 text-sm">
            <Command.Empty className="py-8 text-center text-[#71717a]">
              No matches. Try "create", "P0", "kanban", "AI", "workspace", or type any task/note title.
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
                  <div className="text-xs text-[#71717a]">Natural language — "Ship v2 by Friday P0 @Sarah"</div>
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
                onSelect={() => runCommand(completeRandom)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <CheckSquare className="h-4 w-4 text-[#c084fc]" />
                <div>Complete a random task</div>
                <div className="ml-auto text-[10px] text-[#71717a] font-mono">lucky</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(focusP0s)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Target className="h-4 w-4 text-[#c084fc]" />
                <div>Focus P0 priorities only</div>
                <div className="ml-auto text-[10px] text-[#71717a] font-mono">power</div>
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
                { label: "Today", view: "today" as const, icon: Clock, shortcut: "1" },
                { label: "All Tasks", view: "tasks" as const, icon: CheckSquare, shortcut: "2" },
                { label: "Notes", view: "notes" as const, icon: FileText, shortcut: "3" },
                { label: "Calendar", view: "calendar" as const, icon: Calendar, shortcut: "4" },
                { label: "Teams", view: "teams" as const, icon: Users, shortcut: "5" },
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

            {/* Agent 32: Hybrid semantic results — pre-ranked with keyword + jaccard "semantic" + links + boosts. Magical discovery. */}
            {semanticResults.length > 0 && (
              <Command.Group heading="Semantic Matches (hybrid)" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#c084fc]/80 uppercase mt-2">
                {semanticResults.map((r) => (
                  <Command.Item
                    key={`sem-${r.id}`}
                    onSelect={() => runCommand(() => {
                      if (r.type === 'task') {
                        setView("tasks");
                        selectTask(r.id);
                      } else {
                        setView("notes");
                      }
                      toast.success(`${r.type === 'task' ? 'Task' : 'Note'} • ${r.score}% match`, {
                        description: r.reasons.join(' + '),
                      });
                    })}
                    className="cmdk-item flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
                    value={`${r.type} ${r.title} ${r.reasons.join(' ')}`}
                  >
                    {r.type === 'task' ? <CheckSquare className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                    <div className="flex-1 min-w-0 truncate">{r.title}</div>
                    <div className="text-[9px] text-[#c084fc] font-mono shrink-0 tabular-nums">{r.score}%</div>
                  </Command.Item>
                ))}
                <div className="px-3 py-1 text-[9px] text-[#a1a1aa]">Hybrid: keyword + semantic overlap + graph links • Click to jump</div>
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
                    value={`task ${task.title} ${task.priority} ${task.status} ${task.tags?.join(" ") || ""} ${task.assignee || ""}`}
                  >
                    <CheckSquare className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0 truncate">{task.title}</div>
                    <div className="text-[10px] text-[#71717a] font-mono shrink-0">{task.priority} • {task.status}</div>
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

            {/* Power Views & AI (more actions surfaced directly in palette) */}
            <Command.Group heading="Power & AI" className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[#71717a] uppercase mt-2">
              <Command.Item 
                onSelect={() => runCommand(goToKanban)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Sparkles className="h-4 w-4 text-[#c084fc]" />
                <div>Go to Tasks • switch to Kanban board</div>
                <div className="ml-auto text-[10px] text-[#71717a] font-mono">DND</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(openAIFromPalette)}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Zap className="h-4 w-4 text-[#ff00aa]" />
                <div>Open / focus AI assistant</div>
                <div className="ml-auto text-[10px] text-[#71717a] font-mono">magic</div>
              </Command.Item>

              {/* Agent 32: Knowledge Graph entry point (visual relationships + discovery) */}
              <Command.Item 
                onSelect={() => runCommand(() => {
                  toast("Knowledge Graph", {
                    description: "Open the 🕸️ Knowledge Graph from the header (or Notes detail) for interactive map, link suggestions & semantic clusters.",
                    duration: 5200,
                  });
                })}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <GitBranch className="h-4 w-4 text-[#c084fc]" />
                <div>Open Knowledge Graph (relationships + suggestions)</div>
                <div className="ml-auto text-[10px] text-[#71717a] font-mono">graph</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(async () => {
                  const realMode = isXAIConfigured();
                  const briefing = realMode 
                    ? await generateDailyBriefingAI(tasks, notes, recentActivity)
                    : generateDailyBriefing(tasks, notes, recentActivity);
                  toast.success(realMode ? "xAI Grok Daily Briefing" : "AI Daily Briefing (local)", {
                    description: `${briefing.greeting} ${briefing.focusSuggestion}`,
                    duration: 6000,
                  });
                  console.log("[Bad Ass Tasks AI Briefing]", briefing);
                })}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Zap className="h-4 w-4 text-[#ff00aa]" />
                <div>Generate daily AI briefing</div>
              </Command.Item>

              <Command.Item 
                onSelect={() => runCommand(async () => {
                  if (notes.length === 0) {
                    toast.info("No notes to extract from yet");
                    return;
                  }
                  const realMode = isXAIConfigured();
                  const sorted = [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                  let total = 0;
                  for (const note of sorted.slice(0, 3)) {
                    const items = realMode 
                      ? await extractActionItemsFromTextAI(note.content, note.title)
                      : extractActionItemsFromText(note.content, note.title);
                    for (const item of items.slice(0, 2)) {
                      await addTask(`${item.title} ${item.priority}`);
                      total++;
                    }
                  }
                  toast.success(realMode ? `xAI Grok extracted ${total} tasks from recent notes` : `AI extracted ${total} tasks from recent notes`, {
                    description: "Added via natural language. Open the ✨ AI panel for full linked extraction.",
                    duration: 5000,
                  });
                })}
                className="cmdk-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-white/5"
              >
                <Zap className="h-4 w-4 text-[#ff00aa]" />
                <div>Extract tasks from recent notes</div>
              </Command.Item>
            </Command.Group>

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
              <div>Pro tip: Type task title, "P0", "kanban", "AI", or note name for live results + power actions</div>
              <div className="text-[#c084fc] flex items-center gap-1">Bad Ass Tasks <ArrowRight className="h-3 w-3" /></div>
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
