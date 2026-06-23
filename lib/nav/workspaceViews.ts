import {
  Check,
  FolderOpen,
  Home,
  ListChecks,
  Notebook,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Workspace } from "@/types";
import { isNotesFeatureEnabled } from "@/lib/workspace/workspaceSettings";

export type WorkspaceNavViewId =
  | "home"
  | "tasks"
  | "notes"
  | "notebooks"
  | "lists"
  | "teams"
  | "settings"
  | "admin";

export type WorkspaceNavView = {
  id: WorkspaceNavViewId;
  label: string;
  icon: LucideIcon;
  /** Shorter label for compact nav chrome */
  shortLabel?: string;
};

const ALL_VIEWS: WorkspaceNavView[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "tasks", label: "Tasks", icon: Check },
  { id: "notes", label: "Files", icon: FolderOpen },
  { id: "notebooks", label: "Notes", icon: Notebook },
  { id: "lists", label: "Lists", icon: ListChecks },
  { id: "teams", label: "Team", icon: Users },
  {
    id: "settings",
    label: "Workspace Settings",
    shortLabel: "Settings",
    icon: Settings,
  },
];

function isViewVisible(id: WorkspaceNavViewId, workspace: Workspace): boolean {
  if (id === "notebooks") return isNotesFeatureEnabled(workspace.settings);
  return true;
}

/** Bottom nav + URL routing — includes Home and Settings. */
export function getBottomNavViews(workspace: Workspace): WorkspaceNavView[] {
  return ALL_VIEWS.filter((v) => isViewVisible(v.id, workspace));
}

/** Desktop sidebar workspace views (Home rendered separately). */
export function getSidebarWorkspaceViews(workspace: Workspace): WorkspaceNavView[] {
  return ALL_VIEWS.filter((v) => v.id !== "home" && isViewVisible(v.id, workspace));
}

export function isValidNavView(
  view: string,
  workspace: Workspace,
  opts?: { isSiteAdmin?: boolean },
): view is WorkspaceNavViewId {
  if (view === "admin") return opts?.isSiteAdmin === true;
  if (view === "calendar" || view === "today") return true;
  const allowed = new Set([
    ...getBottomNavViews(workspace).map((v) => v.id),
    ...(opts?.isSiteAdmin ? (["admin"] as const) : []),
  ]);
  return allowed.has(view as WorkspaceNavViewId);
}

export function resolveNavView(view: string): WorkspaceNavViewId {
  if (view === "calendar" || view === "today") return "home";
  return view as WorkspaceNavViewId;
}