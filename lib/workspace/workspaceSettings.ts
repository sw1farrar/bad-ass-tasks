export type WorkspaceSettings = {
  features?: {
    /** When true, shows the Notes nav item and notebooks workspace. */
    notesEnabled?: boolean;
  };
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  features: { notesEnabled: false },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merge persisted JSONB with defaults (workspace-scoped feature flags). */
export function parseWorkspaceSettings(raw: unknown): WorkspaceSettings {
  if (!isRecord(raw)) return { ...DEFAULT_WORKSPACE_SETTINGS };

  const featuresRaw = raw.features;
  const features = isRecord(featuresRaw)
    ? {
        notesEnabled:
          typeof featuresRaw.notesEnabled === "boolean"
            ? featuresRaw.notesEnabled
            : DEFAULT_WORKSPACE_SETTINGS.features?.notesEnabled,
      }
    : { ...DEFAULT_WORKSPACE_SETTINGS.features };

  return { features };
}

export function isNotesFeatureEnabled(settings?: WorkspaceSettings | null): boolean {
  return settings?.features?.notesEnabled === true;
}

/** Deep-merge a partial settings patch onto existing settings. */
export function mergeWorkspaceSettings(
  existing: WorkspaceSettings | undefined,
  patch: WorkspaceSettings,
): WorkspaceSettings {
  const base = parseWorkspaceSettings(existing);
  return {
    features: {
      ...base.features,
      ...patch.features,
    },
  };
}