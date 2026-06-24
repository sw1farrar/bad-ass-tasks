/** Sub-views within a selected notebook. */
export type NotebookSectionTab = "notes" | "tasks" | "investments" | "customers" | "competitors";

export const DEFAULT_NOTEBOOK_SECTION_TAB: NotebookSectionTab = "notes";

export const NOTEBOOK_SECTION_TABS: Array<{ id: NotebookSectionTab; label: string }> = [
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Tasks" },
  { id: "investments", label: "Investments" },
  { id: "customers", label: "Customers" },
  { id: "competitors", label: "Competitors" },
];