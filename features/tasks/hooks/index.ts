/**
 * Tasks hooks barrel (M0).
 *
 * Current:
 * - useTasksFilters: global search + result type + filteredTasks derivation
 *
 * Guard note: Hooks here must not contain direct hybridStore calls or unguarded store access.
 */

export { useTasksFilters } from "./useTasksFilters";
