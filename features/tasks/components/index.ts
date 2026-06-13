/**
 * Tasks UI components barrel (M0 resumption).
 *
 * Currently extracted (Batches 2.4–2.6):
 * - TasksHeader
 * - TasksSearch (hybrid semantic search + filters + results)
 * - TaskList (list mode + empty state)
 *
 * Next targets: KanbanBoard + subcomponents, renderTaskRow logic, etc.
 * All heavy store/guard logic remains in app/page.tsx during early batches.
 */

export { TasksHeader } from "./TasksHeader";
export { TasksSearch } from "./TasksSearch";
export { TaskList } from "./TaskList";
export { TasksTable } from "./TasksTable";
export { TasksStatusFilter, type TasksStatusFilterMode } from "./TasksStatusFilter";
export { TasksOrganizeBar } from "./TasksOrganizeBar";
export { TaskStarButton } from "./TaskStarButton";
export { TaskFolderPicker } from "./TaskFolderPicker";
export { TaskOrganizeFields } from "./TaskOrganizeFields";
export { TaskRow } from "./TaskRow"; // Initial skeleton - logic still being migrated (Batch 2.8)
export { TaskTableDueDateCell } from "./TaskTableDueDateCell";
export { TaskTableFolderCell } from "./TaskTableFolderCell";
export { TaskAssigneeSelectModal } from "./TaskAssigneeSelectModal";
export { TaskFolderSelectModal } from "./TaskFolderSelectModal";
export { TaskTableAssigneeCell } from "./TaskTableAssigneeCell";
export { TaskRecurrenceEditor } from "./TaskRecurrenceEditor";
export { TaskRecurrenceSelectModal } from "./TaskRecurrenceSelectModal";
export { TaskTableRepeatCell } from "./TaskTableRepeatCell";
