/**
 * Teams / Collaboration domain barrel (M0 Batch 2.17).
 *
 * Current:
 * - TeamsView: main shell (presentation only — all logic/guards remain in parent for this batch)
 *
 * Guard note: No store access, no hybridStore, no invite/membership mutations.
 * All of that stays in app/page.tsx during early M0 extractions.
 */

export { TeamsView } from "./TeamsView";
export type { TeamsViewProps } from "./TeamsView";
