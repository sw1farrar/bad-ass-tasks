/** Sub-views within the Health workspace. */
export type HealthSectionTab = "overview" | "weight" | "body" | "vitals" | "activity" | "stress";

export const DEFAULT_HEALTH_SECTION_TAB: HealthSectionTab = "overview";

export const HEALTH_SECTION_TABS: Array<{ id: HealthSectionTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "weight", label: "Weight" },
  { id: "body", label: "Body" },
  { id: "vitals", label: "Vitals" },
  { id: "activity", label: "Activity" },
  { id: "stress", label: "Stress" },
];