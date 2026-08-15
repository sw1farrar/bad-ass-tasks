import {
  NOTEBOOK_SECTION_TABS,
  type NotebookSectionTab,
} from "@/lib/notebooks/notebookSections";

export type NotebookSectionsSettings = Partial<Record<NotebookSectionTab, boolean>>;

export type WorkspaceSettings = {
  features?: {
    /** When true, shows the Notes nav item and notebooks workspace. */
    notesEnabled?: boolean;
    /** When true, shows the Health nav item and health tracking workspace. */
    healthEnabled?: boolean;
    /** When true, shows Map nav and territory/store workspace. */
    mapsEnabled?: boolean;
    /**
     * Which notebook section tabs are visible.
     * Missing keys default to enabled (backward compatible).
     */
    notebookSections?: NotebookSectionsSettings;
  };
};

export const DEFAULT_NOTEBOOK_SECTIONS: Record<NotebookSectionTab, boolean> = {
  notes: true,
  tasks: true,
  investments: true,
  customers: true,
  competitors: true,
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  features: {
    notesEnabled: false,
    healthEnabled: false,
    mapsEnabled: false,
    notebookSections: { ...DEFAULT_NOTEBOOK_SECTIONS },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNotebookSections(raw: unknown): NotebookSectionsSettings {
  if (!isRecord(raw)) return { ...DEFAULT_NOTEBOOK_SECTIONS };

  const sections: NotebookSectionsSettings = { ...DEFAULT_NOTEBOOK_SECTIONS };
  for (const tab of NOTEBOOK_SECTION_TABS) {
    const value = raw[tab.id];
    if (typeof value === "boolean") {
      sections[tab.id] = value;
    }
  }
  return sections;
}

/** Merge persisted JSONB with defaults (workspace-scoped feature flags). */
export function parseWorkspaceSettings(raw: unknown): WorkspaceSettings {
  if (!isRecord(raw)) {
    return {
      features: {
        ...DEFAULT_WORKSPACE_SETTINGS.features,
        notebookSections: { ...DEFAULT_NOTEBOOK_SECTIONS },
      },
    };
  }

  const featuresRaw = raw.features;
  if (!isRecord(featuresRaw)) {
    return {
      features: {
        ...DEFAULT_WORKSPACE_SETTINGS.features,
        notebookSections: { ...DEFAULT_NOTEBOOK_SECTIONS },
      },
    };
  }

  return {
    features: {
      notesEnabled:
        typeof featuresRaw.notesEnabled === "boolean"
          ? featuresRaw.notesEnabled
          : DEFAULT_WORKSPACE_SETTINGS.features?.notesEnabled,
      healthEnabled:
        typeof featuresRaw.healthEnabled === "boolean"
          ? featuresRaw.healthEnabled
          : DEFAULT_WORKSPACE_SETTINGS.features?.healthEnabled,
      mapsEnabled:
        typeof featuresRaw.mapsEnabled === "boolean"
          ? featuresRaw.mapsEnabled
          : DEFAULT_WORKSPACE_SETTINGS.features?.mapsEnabled,
      notebookSections: parseNotebookSections(featuresRaw.notebookSections),
    },
  };
}

export function isNotesFeatureEnabled(settings?: WorkspaceSettings | null): boolean {
  return settings?.features?.notesEnabled === true;
}

export function isHealthFeatureEnabled(settings?: WorkspaceSettings | null): boolean {
  return settings?.features?.healthEnabled === true;
}

export function isMapsFeatureEnabled(settings?: WorkspaceSettings | null): boolean {
  return settings?.features?.mapsEnabled === true;
}

export function isNotebookSectionEnabled(
  settings: WorkspaceSettings | null | undefined,
  tab: NotebookSectionTab,
): boolean {
  const sections = settings?.features?.notebookSections;
  if (!sections || sections[tab] === undefined) return true;
  return sections[tab] === true;
}

/** Ordered list of enabled notebook section tabs (defaults all on when unset). */
export function getEnabledNotebookSections(
  settings?: WorkspaceSettings | null,
): NotebookSectionTab[] {
  return NOTEBOOK_SECTION_TABS.filter((tab) => isNotebookSectionEnabled(settings, tab.id)).map(
    (tab) => tab.id,
  );
}

/** Deep-merge a partial settings patch onto existing settings. */
export function mergeWorkspaceSettings(
  existing: WorkspaceSettings | undefined,
  patch: WorkspaceSettings,
): WorkspaceSettings {
  const base = parseWorkspaceSettings(existing);
  const patchSections = patch.features?.notebookSections;

  return {
    features: {
      ...base.features,
      ...patch.features,
      notebookSections: {
        ...base.features?.notebookSections,
        ...(patchSections ?? {}),
      },
    },
  };
}
