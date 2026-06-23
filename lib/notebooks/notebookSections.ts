/** Sub-views within a selected notebook (extensible for future tabs). */
export type NotebookSectionTab = "notes";

export const DEFAULT_NOTEBOOK_SECTION_TAB: NotebookSectionTab = "notes";

export const NOTEBOOK_SECTION_TABS: Array<{ id: NotebookSectionTab; label: string }> = [
  { id: "notes", label: "Notes" },
];