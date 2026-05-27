"use client";

import { useState, useEffect } from "react";
import { Send, Sparkles, X, Zap, FileText, Target } from "lucide-react";
import { toast } from "sonner";
import { useTaskStore } from "@/store/useTaskStore";
import { 
  getAIResponse, 
  generateDailyBriefing, generateDailyBriefingAI,
  generateWeeklyBriefing, generateWeeklyBriefingAI,
  extractActionItemsFromText, extractActionItemsFromTextAI,
  isXAIConfigured, 
  getProactiveSuggestions, getProactiveSuggestionsAI,
  generateSubtaskDecompositionAI, // for future chat-driven decomp
  triggerHaptic 
} from "@/lib/utils";
import type { Task } from "@/types";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

/**
 * Enhanced AIChatPanel (Agent 9/15/26 + Agent 29 real xAI)
 * - Fully data-aware via Zustand (tasks + notes + activity)
 * - High-quality sim (always magical, instant) + optional real xAI Grok (structured + specialized prompts)
 * - Quick actions now prefer real *AI variants when configured (briefings, extract, proactive feel like true superpowers)
 * - Chat uses getAIResponse (enhanced real path)
 * - Real extraction creates linked tasks + subtasks
 * - Badges show "xAI LIVE" vs "SIM • DEMO"
 * 
 * To switch: set NEXT_PUBLIC_XAI_API_KEY (demo) or use server proxy in prod. See lib/utils.ts + AGENT-29 handoff.
 * Simulation never removed — seamless graceful fallback + rate limiting handled in utils.
 */
export function AIChatPanel({ onClose }: { onClose: () => void }) {
  const {
    tasks,
    notes,
    currentWorkspace,
    addTask,
    updateNote,
    updateTask,
    recentActivity,
  } = useTaskStore();

  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content:
        "Hey! I see everything in " +
        currentWorkspace.name +
        ". Ask me to extract tasks, generate a briefing, find focus, or plan your week. What do you need?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const workspaceName = currentWorkspace.name;

  // Mobile bottom sheet (Agent 27 completion): drag-to-dismiss on phones, matches TaskModal pattern exactly.
  // Desktop unchanged (fixed panel). Haptics + safe areas.
  const [isMobile, setIsMobile] = useState(false);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Haptic on open (mobile native confirmation)
  useEffect(() => {
    if (isMobile) {
      triggerHaptic('light');
    }
  }, [isMobile]);

  const handleSheetClose = () => {
    if (isMobile) triggerHaptic('light');
    onClose();
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      handleSheetClose();
    } else {
      setDragY(0);
    }
  };

  // Quick action chips (magical one-click superpowers) — Agent 15 + Agent 26 proactive + activity-aware
  const quickActions = [
    { label: "Daily Briefing", icon: Zap, action: () => triggerBriefing() },
    { label: "Weekly Briefing", icon: Zap, action: () => triggerWeeklyBriefing() },
    { label: "Extract Recent Notes", icon: FileText, action: () => triggerExtractFromRecent() },
    { label: "What's my focus?", icon: Target, action: () => triggerFocusQuery() },
    { label: "Proactive Insights", icon: Zap, action: () => triggerProactive() },
  ];

  async function triggerBriefing() {
    setIsThinking(true);
    const realMode = isXAIConfigured();
    const briefing = realMode 
      ? await generateDailyBriefingAI(tasks, notes, recentActivity)
      : generateDailyBriefing(tasks, notes, recentActivity);

    const msg = `**Daily Briefing for ${workspaceName}**\n\n${briefing.greeting}\n\n${briefing.summary}\n\nFocus move: ${briefing.focusSuggestion}\n\nP0s: ${briefing.stats.p0Count} • Due/overdue: ${briefing.stats.dueToday} • Notes: ${briefing.stats.notesCount}`;

    setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
    setIsThinking(false);

    toast.success(realMode ? "xAI Grok Daily Briefing" : "AI Daily Briefing (local)", {
      description: briefing.focusSuggestion,
    });
  }

  async function triggerWeeklyBriefing() {
    setIsThinking(true);
    const realMode = isXAIConfigured();
    const briefing = realMode 
      ? await generateWeeklyBriefingAI(tasks, notes, recentActivity) as any
      : generateWeeklyBriefing(tasks, notes, recentActivity) as any;

    const msg = `**Weekly Briefing for ${workspaceName}**\n\n${briefing.greeting}\n\n${briefing.summary}\n\nTop actions:\n${(briefing.weekActions || []).map((a: string, i: number) => `${i+1}. ${a}`).join("\n")}\n\nTrend: ${briefing.trend || ""} • Focus days: ${briefing.focusDays || ""}`;

    setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
    setIsThinking(false);

    toast.success(realMode ? "xAI Grok Weekly Briefing" : "AI Weekly Briefing (local)", {
      description: briefing.focusSuggestion || "Actionable plan ready.",
    });
  }

  async function triggerExtractFromRecent() {
    if (notes.length === 0) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "No notes yet. Create one in the Notes view and I'll extract gold from it." },
      ]);
      return;
    }

    setIsThinking(true);
    const realMode = isXAIConfigured();

    // Take the 3 most recently updated notes
    const sorted = [...notes].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const targets = sorted.slice(0, 3);

    let totalExtracted = 0;
    const createdTasks: Task[] = [];

    for (const note of targets) {
      const items = realMode 
        ? await extractActionItemsFromTextAI(note.content, note.title)
        : extractActionItemsFromText(note.content, note.title);
      for (const item of items) {
        try {
          // Real creation via the store (works in demo + live hybrid)
          const res = await addTask(`${item.title} ${item.priority}`);
          if (!res) {
            continue;
          }
          const newTask = res;

          // Best-effort: set better priority/due if the natural parser didn't catch everything
          if (item.priority !== "P2" || item.dueDate) {
            await updateTask(newTask.id, {
              priority: item.priority,
              dueDate: item.dueDate,
              ...(item.tags?.length ? { tags: [...(newTask.tags || []), ...item.tags] } : {}),
            });
          }

          // Bidirectional link
          const updatedLinked = [...(note.linkedTaskIds || []), newTask.id];
          await updateNote(note.id, { linkedTaskIds: Array.from(new Set(updatedLinked)) });

          // Also link back on the task
          await updateTask(newTask.id, {
            linkedNoteIds: [...(newTask.linkedNoteIds || []), note.id],
          });

          // Agent 15: decomposition — if extract yielded subSteps, create them as child tasks (parentTaskId)
          if (item.subSteps && item.subSteps.length) {
            for (const sub of item.subSteps.slice(0, 2)) { // cap for delight
              try {
                const childRes = await addTask(`${sub} (sub)`);
                if (!childRes) {
                  continue;
                }
                const child = childRes;
                await updateTask(child.id, {
                  parentTaskId: newTask.id,
                  priority: item.priority === "P0" ? "P1" : item.priority,
                  linkedNoteIds: [note.id],
                });
                // link child back too
                await updateTask(child.id, { linkedNoteIds: [...(child.linkedNoteIds || []), note.id] });
                totalExtracted++;
              } catch {}
            }
          }

          createdTasks.push(newTask);
          totalExtracted++;
        } catch (e) {
          console.warn("AI extract task create failed (kept going)", e);
        }
      }
    }

    setIsThinking(false);

    const reply =
      totalExtracted > 0
        ? `Extracted ${totalExtracted} real action items from your recent notes and added them as tasks (with bidirectional links). Check your Inbox / Today view.`
        : "Scanned your latest notes. The content was thoughtful but didn't yield crisp action verbs. Want me to help you rewrite a note with clearer next steps?";

    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

    if (totalExtracted > 0) {
      toast.success(realMode ? `xAI Grok extracted ${totalExtracted} tasks` : `AI extracted ${totalExtracted} tasks`, {
        description: "Linked back to their source notes. Beautiful.",
      });
    }
  }

  function triggerFocusQuery() {
    const active = tasks.filter((t) => t.status !== "done");
    const p0 = active.filter((t) => t.priority === "P0")[0];
    const due = active.find((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now() + 86400000 * 2);

    const focusText = p0
      ? `Your #1 focus: "${p0.title}". Drop everything else until it ships.`
      : due
      ? `Time-sensitive: "${due.title}". Clear it before it becomes tomorrow's emergency.`
      : "Plate is clear. Block deep work time on your most ambitious project.";

    setMessages((prev) => [...prev, { role: "assistant", content: focusText }]);
  }

  // Agent 26/29 proactive system trigger (uses real xAI structured suggestions when available)
  async function triggerProactive() {
    const realMode = isXAIConfigured();
    setIsThinking(true);
    const pros = realMode 
      ? await getProactiveSuggestionsAI(tasks, notes, recentActivity)
      : getProactiveSuggestions(tasks, notes, recentActivity);
    setIsThinking(false);

    if (!pros.length) {
      setMessages((prev) => [...prev, { role: "assistant", content: "All signals strong right now. Clear runway for ambitious work." }]);
      return;
    }
    const content = `**Proactive AI Insights**\n\n${pros.map((p, i) => `${i+1}. ${p.message}\n   → ${p.actionHint}`).join("\n\n")}\n\nReply with any (e.g. "break down the overdue one") and I'll act.`;
    setMessages((prev) => [...prev, { role: "assistant", content }]);
    toast.success(realMode ? "xAI Grok Proactive Insights" : "Proactive scan complete", { description: `${pros.length} high-signal nudges` });
  }

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsThinking(true);

    // Build live context for the AI brain (this is what makes it feel magical)
    const aiContext = {
      tasks,
      notes,
      currentWorkspaceName: workspaceName,
      activity: recentActivity,
    };

    // The core call — real xAI if configured, otherwise world-class simulation
    const { reply, suggestedAction } = await getAIResponse(trimmed, aiContext);

    // Post-process for real actions when user says the magic words
    let finalReply = reply;
    if (suggestedAction === "extract" || /add them|promote|create the task/i.test(trimmed)) {
      // If the sim suggested extraction, actually do a quick recent-notes extract
      // (user can also use the dedicated button for more control)
      await triggerExtractFromRecent();
      finalReply = reply + "\n\n(I went ahead and promoted the strongest items into real tasks with links.)";
    }

    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", content: finalReply }]);
      setIsThinking(false);

      if (suggestedAction === "real-xai") {
        toast("Real xAI Grok response", { description: "Using live model — beautiful." });
      }
    }, 180); // tiny extra polish delay for "thinking" feel
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const realMode = isXAIConfigured();

  // Shared inner content (desktop panel or mobile sheet body)
  const panelInner = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10" style={isMobile ? { paddingTop: 'max(12px, env(safe-area-inset-top, 8px))' } : {}}>
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-[#ff00aa]" /> AI Assistant
          <span className="text-[10px] px-1.5 py-px rounded bg-white/5 text-[#71717a] font-mono tracking-widest">
            {realMode ? "xAI LIVE" : "SIM • DEMO"}
          </span>
        </div>
        <button onClick={handleSheetClose} className="text-[#71717a] hover:text-white active:scale-95">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick magic actions */}
      <div className="px-4 pt-3 pb-1 flex gap-1.5 flex-wrap border-b border-white/5">
        {quickActions.map((qa, idx) => (
          <button
            key={idx}
            onClick={qa.action}
            disabled={isThinking}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[#c084fc] border border-white/10 disabled:opacity-50 transition active:scale-[0.98]"
          >
            <qa.icon className="h-3 w-3" /> {qa.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4 text-sm custom-scroll">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[88%] rounded-2xl px-4 py-2 whitespace-pre-wrap leading-snug ${
                m.role === "user" ? "bg-[#c084fc] text-black" : "bg-white/5"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-[#71717a] text-xs pl-1">
            <Sparkles className="h-3 w-3 animate-pulse text-[#ff00aa]" /> Thinking with the full picture…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-white/10 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Extract from my notes, brief me, or ask anything…"
          className="input flex-1 text-sm px-4 rounded-2xl"
          disabled={isThinking}
        />
        <button
          onClick={sendMessage}
          disabled={isThinking || !input.trim()}
          className="btn btn-primary px-4 disabled:opacity-60 active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Footer / integration note */}
      <div className="px-4 py-2 text-[9px] text-[#71717a] border-t border-white/5 flex items-center justify-between font-mono tracking-widest" style={isMobile ? { paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' } : {}}>
        <span>Sees your tasks + notes live</span>
        <span>{realMode ? "Powered by xAI Grok" : "High-fidelity simulation • real xAI ready"}</span>
      </div>
    </>
  );

  if (!isMobile) {
    // Desktop: original premium fixed panel (unchanged)
    return (
      <div className="fixed bottom-6 right-6 w-96 glass rounded-3xl border border-[#ff00aa]/20 flex flex-col h-[520px] z-[90] shadow-2xl">
        {panelInner}
      </div>
    );
  }

  // Mobile: bottom sheet with drag-to-dismiss (native iOS/Android feel)
  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[180] flex items-end sheet-backdrop"
        onClick={handleSheetClose}
      >
        <motion.div
          className="mobile-bottom-sheet glass w-full overflow-hidden border-t border-white/10"
          onClick={e => e.stopPropagation()}
          drag="y"
          dragConstraints={{ top: -20, bottom: 300 }}
          dragElastic={0.2}
          dragDirectionLock
          onDragEnd={handleDragEnd}
          onDrag={(e, info) => setDragY(Math.max(0, info.offset.y))}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: dragY, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.85 }}
          style={{ touchAction: 'pan-y' }}
        >
          {/* Drag handle for native affordance */}
          <div className="sheet-drag-handle" aria-hidden="true" />
          {panelInner}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
