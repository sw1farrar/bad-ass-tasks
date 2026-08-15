import type {
  ActivityMixSlice,
  DailyCountPoint,
  DailyEngagementPoint,
} from "@/lib/admin/activityAnalytics";

export type PlatformUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  accessPaused: boolean;
  accessPausedAt: string | null;
  workspaceCount: number;
  taskCount: number;
  noteCount: number;
  lastSignInAt: string | null;
};

export type PlatformStats = {
  totalUsers: number;
  activeUsers7d: number;
  pausedUsers: number;
  totalWorkspaces: number;
  totalTasks: number;
  totalNotes: number;
  totalComments: number;
  signupsLast7d: number;
  signupsLast24h: number;
  activityLast24h: number;
  generatedAt: string;
};

export type PlatformActivityRow = {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  actionType: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type PlatformLoginEventRow = {
  id: string;
  userId: string | null;
  email: string | null;
  userName: string | null;
  eventType: string;
  authMethod: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type PlatformAnalytics = {
  activityByDay: DailyEngagementPoint[];
  signupsByDay: DailyCountPoint[];
  activityMix: ActivityMixSlice[];
  engagementRate7d: number;
  contentEvents7d: number;
  avgDailyActiveUsers7d: number;
  peakDay: { label: string; count: number } | null;
  generatedAt: string;
};
