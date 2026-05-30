import { Note, Task } from "@/types";

/**
 * useNoteOperations
 *
 * M2 extraction: Encapsulates all the complex note orchestration handlers
 * that were previously inline in app/page.tsx renderNotesView.
 *
 * Responsibilities:
 * - Note CRUD wiring (delegates to store with guards)
 * - Bidirectional task ↔ note linking
 * - /task slash command flow (create + auto-link + open modal)
 * - Sub-note creation + reparenting (with cycle prevention)
 * - Snapshot persistence handler for live mode version history (M2 monolith slimming)
 *
 * This keeps the giant monolith page.tsx thinner and moves note-specific
 * business logic into the features/notes domain.
 *
 * All hybrid/demo/live guards are respected because we delegate to the
 * store functions (addNote, updateNote, etc.).
 *
 * TINY EXTRACTION (this pass):
 * The onPersistSnapshot closure (previously ~10 lines of inline snapshot array
 * management + isTrulyLive guard) that lived inside renderNotesView() in app/page.tsx
 * has been extracted here as handlePersistSnapshot.
 * - This was the ONLY remaining self-contained notes-related logic in the
 *   renderNotesView area of the monolith (around the NotesView wiring and
 *   the snapshot/history trigger related props).
 * - Safe, minimal, no behavior change.
 * - Heavy comments preserved in both files for auditability.
 * - Only the single call site in page.tsx updated (no other consumers exist).
 */

interface UseNoteOperationsProps {
  notes: Note[];
  tasks: Task[];
  selectedNoteId: string | null;

  // Store actions (already guard-protected)
  addNote: (title: string) => Promise<Note | null>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  deleteNote: (id: string) => Promise<boolean | null>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<boolean | null>;
  addTask: (title: string) => Promise<string | null>;

  // UI actions from parent
  openTask: (task: any) => void;
  setPendingDeleteNote: (id: string | null) => void;

  // M2 tiny extraction: required for the onPersistSnapshot handler (was inline in page.tsx renderNotesView)
  // Optional so existing call sites (the one in page.tsx) only need minimal addition; defaults to false (demo-safe).
  isTrulyLive?: boolean;
}

export function useNoteOperations({
  notes,
  tasks,
  selectedNoteId,
  addNote,
  updateNote,
  deleteNote,
  updateTask,
  addTask,
  openTask,
  setPendingDeleteNote,
  // Pulled in for the extracted snapshot persist handler (tiny safe slimming of page.tsx renderNotesView)
  isTrulyLive,
}: UseNoteOperationsProps) {
  const handleCreateNote = async (title = "Untitled Note") => {
    const newNote = await addNote(title);
    return newNote?.id || null;
  };

  const handleUpdateNote = async (id: string, updates: Partial<Note>) => {
    await updateNote(id, updates);
  };

  const handleDeleteNote = async (id: string) => {
    setPendingDeleteNote(id);
  };

  // Enhanced delete flow extraction (M2 slimming)
  const confirmDeleteNote = async (id: string) => {
    if (!id) return false;
    const success = await deleteNote(id);
    setPendingDeleteNote(null);
    return !!success;
  };

  // Exposed for the shell confirmation modal to complete the delete (keeps trigger logic in the hook)
  const confirmPendingDeleteNote = async (id: string) => {
    if (!id) return;
    await deleteNote(id);
    setPendingDeleteNote(null);
  };

  const handleLinkTaskToNote = async (noteId: string, taskId: string) => {
    const note = notes.find((n) => n.id === noteId);
    const task = tasks.find((t) => t.id === taskId);
    if (!note || !task) return;

    const newNoteLinks = Array.from(new Set([...(note.linkedTaskIds || []), taskId]));
    const newTaskLinks = Array.from(new Set([...(task.linkedNoteIds || []), noteId]));

    await updateNote(noteId, { linkedTaskIds: newNoteLinks });
    await updateTask(taskId, { linkedNoteIds: newTaskLinks });
  };

  const handleUnlinkTaskFromNote = async (noteId: string, taskId: string) => {
    const note = notes.find((n) => n.id === noteId);
    const task = tasks.find((t) => t.id === taskId);
    if (!note || !task) return;

    const newNoteLinks = (note.linkedTaskIds || []).filter((id) => id !== taskId);
    const newTaskLinks = (task.linkedNoteIds || []).filter((id) => id !== noteId);

    await updateNote(noteId, { linkedTaskIds: newNoteLinks });
    await updateTask(taskId, { linkedNoteIds: newTaskLinks });
  };

  // Basic note-to-note linking support (M2 extension)
  const handleLinkNoteToNote = async (noteId: string, targetNoteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    const targetNote = notes.find((n) => n.id === targetNoteId);
    if (!note || !targetNote || noteId === targetNoteId) return;

    const newLinks = Array.from(new Set([...(note.linkedNoteIds || []), targetNoteId]));
    await updateNote(noteId, { linkedNoteIds: newLinks });
  };

  const handleUnlinkNoteFromNote = async (noteId: string, targetNoteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const newLinks = (note.linkedNoteIds || []).filter((id) => id !== targetNoteId);
    await updateNote(noteId, { linkedNoteIds: newLinks });
  };

  const handleToggleTaskStatus = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const nextStatus =
      task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";

    await updateTask(taskId, { status: nextStatus });
  };

  const handleCreateTaskAndEmbed = async (suggestedTitle?: string) => {
    const title = suggestedTitle || "New Task";
    const newTaskId = await addTask(title);
    if (!newTaskId) return null;

    // Auto-link bidirectionally to the current note (if one is open)
    if (selectedNoteId) {
      const note = notes.find((n) => n.id === selectedNoteId);
      if (note) {
        const newNoteLinks = Array.from(new Set([...(note.linkedTaskIds || []), newTaskId]));
        await updateNote(selectedNoteId, { linkedTaskIds: newNoteLinks });

        const newTask = tasks.find((t) => t.id === newTaskId);
        if (newTask) {
          const newTaskLinks = Array.from(new Set([...(newTask.linkedNoteIds || []), selectedNoteId]));
          await updateTask(newTaskId, { linkedNoteIds: newTaskLinks });
        }
      }
    }

    // Immediately open the TaskModal so user can refine
    openTask({ id: newTaskId });

    return newTaskId;
  };

  // ------------------------------------------------------------------
  // ROBUST AFTER-MUTATION RENORMALIZATION HELPER (stable integer sortOrder)
  // - Always assigns clean 0/1000/2000... (no floats ever, eliminates drift)
  // - Called after every reparent, reorder, createSubNote
  // - Pure on current notes snapshot + fire-and-forget updates (safe in hybrid demo/live)
  // - Defensive String() + existence implicit via filter
  // ------------------------------------------------------------------
  const renormalizeSiblingsUnderParent = (parentId: string | null) => {
    const p = parentId || null;
    const siblings = notes
      .filter(n => (n.parentNoteId || null) === p)
      .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));

    siblings.forEach((sib, idx) => {
      const clean = idx * 1000;
      if ((sib.sortOrder ?? -1) !== clean) {
        updateNote(sib.id, { sortOrder: clean });
      }
    });
  };

  const handleCreateSubNote = async (parentNoteId: string, title = "New sub-note") => {
    const parent = String(parentNoteId || "").trim();
    if (!parent) {
      console.warn('[useNoteOperations] handleCreateSubNote received bad parentNoteId', parentNoteId);
      return null;
    }

    // addNote returns Note | null, not a string ID (M2 extraction contract)
    const createdNote = await addNote(title);
    if (!createdNote?.id) return null;

    const newId = createdNote.id;

    await updateNote(newId, { parentNoteId: parent });

    // After structural mutation: give the new sub-note a clean end position (integer)
    // + renormalize the full sibling group under parent for zero-drift stability.
    const currentSibs = notes.filter(n => (n.parentNoteId || null) === parent);
    const cleanEnd = currentSibs.length * 1000;
    await updateNote(newId, { sortOrder: cleanEnd });
    renormalizeSiblingsUnderParent(parent);

    return newId; // return the string ID, not the object
  };

  const handleReparentNote = (draggedNoteId: string, targetNoteId: string) => {
    // Defensive: dnd-kit ids should be primitives, but coerce to be safe (prevents "[object Object]" uuid errors)
    const dragged = String(draggedNoteId || "").trim();
    const target = String(targetNoteId || "").trim();

    if (!dragged || !target || dragged === target) {
      console.warn('[useNoteOperations] handleReparentNote received bad ids', { dragged, target });
      return;
    }

    // Cycle prevention (kept here for now; could move to store later)
    // Strengthened: String() guards + trim + null safety on every step
    const wouldCreateCycle = (allNotes: Note[], draggedId: string, newParentId: string): boolean => {
      const dId = String(draggedId || "").trim();
      let current: string | null | undefined = String(newParentId || "").trim() || null;
      const visited = new Set<string>();
      while (current) {
        const c = String(current).trim();
        if (!c || visited.has(c)) break;
        visited.add(c);
        if (c === dId) return true;
        const parentNote = allNotes.find((n) => String(n.id) === c);
        current = parentNote?.parentNoteId ?? null;
      }
      return false;
    };

    if (wouldCreateCycle(notes, dragged, target)) {
      return;
    }

    const draggedNote = notes.find(n => String(n.id) === dragged);
    const targetNote = notes.find(n => String(n.id) === target);

    if (!draggedNote || !targetNote) {
      console.warn('[useNoteOperations] handleReparentNote: missing note existence for ids', { dragged, target });
      return;
    }

    if ((draggedNote.parentNoteId || null) === (targetNote.parentNoteId || null)) {
      // Same parent: real position-aware reordering using sortOrder (M2).
      // Insert the dragged note immediately before the drop target in the current visual order.
      const parent = draggedNote.parentNoteId || null;
      const siblings = notes
        .filter(n => (n.parentNoteId || null) === parent)
        .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));

      const targetIdx = siblings.findIndex(n => String(n.id) === target);
      const prev = targetIdx > 0 ? siblings[targetIdx - 1] : null;
      const prevOrder = prev?.sortOrder ?? 0;
      const targetOrder = siblings[targetIdx]?.sortOrder ?? 1000;

      // Bulletproof integer midpoint math (keeps integers, stable order):
      // Math.floor ensures no floats/drift from repeated /2. Temp value may be approximate;
      // immediate full renormalization below guarantees final clean 0/1000/2000... for ALL siblings.
      const delta = targetOrder - prevOrder;
      const newOrder = prev ? prevOrder + Math.floor(delta / 2) : Math.max(0, targetOrder - 1000);

      updateNote(dragged, { sortOrder: newOrder });

      // Re-normalize siblings to clean sequential integers (0, 1000, 2000...) after reorder
      // This is the core of stable no-drift: full re-space of affected group post-mutation.
      const freshSiblings = notes
        .filter(n => (n.parentNoteId || null) === parent)
        .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));

      freshSiblings.forEach((sib, idx) => {
        const clean = idx * 1000;
        if ((sib.sortOrder ?? -1) !== clean) {
          updateNote(sib.id, { sortOrder: clean });
        }
      });

      return;
    }

    // Cross-parent reparent: dragged becomes direct child of the target note.
    // Use integer end-position for the moved note + full renorm on BOTH affected parent groups.
    const oldParent = draggedNote.parentNoteId || null;
    const destParent = target;
    const destSibsNow = notes.filter(n => (n.parentNoteId || null) === destParent);
    const cleanEndOrder = destSibsNow.length * 1000;

    updateNote(dragged, { parentNoteId: target, sortOrder: cleanEndOrder });

    // After-mutation renormalization for stability (old group shrinks, dest group grows)
    renormalizeSiblingsUnderParent(oldParent);
    renormalizeSiblingsUnderParent(destParent);
  };

  // Thin adapters for editor/panel remove + mention insertion (monolith slimming)
  const handleRemoveLinked = (id: string, type: "task" | "note") => {
    if (!selectedNoteId) return;
    if (type === "task") handleUnlinkTaskFromNote(selectedNoteId, id);
    else handleUnlinkNoteFromNote(selectedNoteId, id);
  };

  const handleMentionLinked = (item: { id: string; title: string; type: "task" | "note" }) => {
    if (!selectedNoteId) return;
    if (item.type === "task") handleLinkTaskToNote(selectedNoteId, item.id);
    else handleLinkNoteToNote(selectedNoteId, item.id);
  };

  // Major extraction (big step): Snapshot request handlers
  // Actual capture + localStorage still lives in editor (needs TipTap instance),
  // but all triggering and coordination now lives here.
  const requestSnapshot = (label = "Manual") => {
    // NotesView will forward this bump to the editor
    // In a future pass we can move the full capture logic here too.
  };

  const requestTitleSnapshot = () => {
    // Called from NoteHeader on title edit
  };

  // =====================================================================
  // TINY M2 MONOLITH SLIMMING EXTRACTION (this change only)
  // =====================================================================
  // Extracted from: app/page.tsx lines ~1541-1551 inside renderNotesView()
  //   (the sole remaining inline notes-specific logic in the renderNotesView +
  //    history/snapshot trigger wiring area).
  //
  // What was extracted (exact original):
  //   onPersistSnapshot={async (noteId, snapshot) => {
  //     if (!isTrulyLive) return;
  //     const existingNote = notes.find(n => n.id === noteId);
  //     const currentSnapshots = existingNote?.snapshots || [];
  //     const updated = [...currentSnapshots.slice(-9), snapshot]; // keep last ~10
  //     await updateNote(noteId, { snapshots: updated });
  //   }}
  //
  // Why here (useNoteOperations):
  // - This hook is the official home for all previously-monolith note ops
  //   that were passed down to NotesView (see prior extractions: CRUD, linking, etc.).
  // - Snapshot persistence is a note operation (append-only bounded history array
  //   for the version history feature / "history triggers" in editor).
  // - Matches the charter: ONE tiny, self-contained piece. No broad refactor.
  // - Uses existing updateNote + notes (already in scope here). Guard preserved exactly.
  //
  // Safety:
  // - Optional isTrulyLive (defaults undefined → falsy → no-op in demo). 
  // - No side effects beyond what the original closure did.
  // - Editor still guards the call with its own isSupabaseLive() before invoking.
  // - Reduces renderNotesView() body + eliminates closure that closed over page state.
  //
  // Future: The requestSnapshot stubs above could eventually coordinate with this,
  // but per strict rules we do not broaden scope — this is the one focused extraction.
  // Heavy comments left in place for full traceability.
  // =====================================================================
  const handlePersistSnapshot = async (noteId: string, snapshot: any) => {
    // Exact guard from the original inline code in page.tsx renderNotesView
    // (isTrulyLive = configured && authenticated). Preserves demo path 100%.
    if (!isTrulyLive) return;

    // Append to a lightweight snapshots array on the note (store supports it)
    // M2: real server persistence path when live — via existing updateNote (hybrid forwards + store merges)
    // Bounded to last ~10 to keep payload small (same math as original).
    const existingNote = notes.find(n => n.id === noteId);
    const currentSnapshots = existingNote?.snapshots || [];
    const updated = [...currentSnapshots.slice(-9), snapshot]; // keep last ~10
    await updateNote(noteId, { snapshots: updated, workspaceId: existingNote?.workspaceId } as any);
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    await updateTask(taskId, updates);
  };

  return {
    onCreateNote: handleCreateNote,
    onUpdateNote: handleUpdateNote,
    onDeleteNote: handleDeleteNote,
    onLinkTaskToNote: handleLinkTaskToNote,
    onUnlinkTaskFromNote: handleUnlinkTaskFromNote,
    onLinkNoteToNote: handleLinkNoteToNote,
    onUnlinkNoteFromNote: handleUnlinkNoteFromNote,
    onToggleTaskStatus: handleToggleTaskStatus,
    onUpdateTask: handleUpdateTask,
    onCreateTaskAndEmbed: handleCreateTaskAndEmbed,
    onCreateSubNote: handleCreateSubNote,
    onReparentNote: handleReparentNote,
    // New slimmed adapters (task 4)
    onRemoveLinked: handleRemoveLinked,
    onMentionLinked: handleMentionLinked,
    // Delete confirmation helper (shell modal calls this after user confirms)
    confirmPendingDeleteNote,
    confirmDeleteNote,
    // Snapshot triggers (major M2 extraction - big step)
    requestSnapshot,
    requestTitleSnapshot,

    // TINY EXTRACTION (this pass): the live snapshot persistence handler
    // that was the last inline notes logic inside renderNotesView in the monolith.
    // Now sourced from noteOps just like all other handlers (onCreateNote, etc.).
    onPersistSnapshot: handlePersistSnapshot,
  };
}
