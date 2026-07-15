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

export const DEFAULT_NOTEBOOK_ENABLED_SECTIONS: NotebookSectionTab[] = NOTEBOOK_SECTION_TABS.map(
  (tab) => tab.id,
);

const NOTEBOOK_SECTION_TAB_SET = new Set<NotebookSectionTab>(
  NOTEBOOK_SECTION_TABS.map((tab) => tab.id),
);

/** Notes is always included — it is the core notebook surface. */
export const REQUIRED_NOTEBOOK_SECTION: NotebookSectionTab = "notes";

export function normalizeNotebookEnabledSections(
  sections: NotebookSectionTab[] | null | undefined,
): NotebookSectionTab[] {
  const seen = new Set<NotebookSectionTab>();
  const normalized: NotebookSectionTab[] = [];

  for (const section of sections ?? DEFAULT_NOTEBOOK_ENABLED_SECTIONS) {
    if (!NOTEBOOK_SECTION_TAB_SET.has(section) || seen.has(section)) continue;
    seen.add(section);
    normalized.push(section);
  }

  if (!normalized.includes(REQUIRED_NOTEBOOK_SECTION)) {
    normalized.unshift(REQUIRED_NOTEBOOK_SECTION);
  }

  return normalized.length > 0 ? normalized : [REQUIRED_NOTEBOOK_SECTION];
}

export function resolveNotebookEnabledSections(
  notebook: { enabledSections?: NotebookSectionTab[] | null } | null | undefined,
): NotebookSectionTab[] {
  return normalizeNotebookEnabledSections(notebook?.enabledSections);
}

export function getNotebookSectionTabsForNotebook(
  notebook: { enabledSections?: NotebookSectionTab[] | null } | null | undefined,
): Array<{ id: NotebookSectionTab; label: string }> {
  const enabled = new Set(resolveNotebookEnabledSections(notebook));
  return NOTEBOOK_SECTION_TABS.filter((tab) => enabled.has(tab.id));
}

export function coerceNotebookEnabledSections(
  value: unknown,
): NotebookSectionTab[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return normalizeNotebookEnabledSections(
    value.filter((item): item is NotebookSectionTab => typeof item === "string"),
  );
}