/**
 * features/tasks
 * 
 * Tasks domain (M0 resumption starting Batch 2.4)
 * 
 * Current extractions (as of Batch 2.9):
 * - TasksHeader (view controls + natural add)
 * - TasksSearch (hybrid semantic search + filters + results)
 * - TaskList (list mode + empty state)
 * - KanbanBoard (full DnD board + subcomponents)
 * - TaskRow (presentation + swipe gestures)
 *
 * Guard note: All store selectors, filteredTasks derivation, business handlers 
 * (handleComplete, etc.), and demo/live guards remain in app/page.tsx.
 */
export { TasksHeader } from "./components/TasksHeader";
export { TasksSearch } from "./components/TasksSearch";
export { TaskList } from "./components/TaskList";
export { TasksTable } from "./components/TasksTable";
export { TaskRow } from "./components/TaskRow";

// Future:
// export * from "./components";
// export * from "./hooks";
