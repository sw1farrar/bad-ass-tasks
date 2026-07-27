import { describe, it, expect, vi, beforeEach } from "vitest";
import { fanoutTaskCompletedNotifications } from "@/lib/notifications/fanoutTaskCompleted";

vi.mock("@/lib/notifications/sendNotificationEmail", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(true),
}));

function createMockSupabase(members: unknown[], workspaceName = "Farrar Home") {
  const notificationInserts: unknown[] = [];

  const membersBuilder = {
    select: vi.fn(() => membersBuilder),
    eq: vi.fn(() => Promise.resolve({ data: members, error: null })),
  };

  const workspacesBuilder = {
    select: vi.fn(() => workspacesBuilder),
    eq: vi.fn(() => workspacesBuilder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: { name: workspaceName }, error: null })),
  };

  const notificationsBuilder = {
    select: vi.fn(() => notificationsBuilder),
    eq: vi.fn(() => notificationsBuilder),
    contains: vi.fn(() => Promise.resolve({ data: [], error: null })),
    insert: vi.fn((payload: unknown) => {
      notificationInserts.push(payload);
      return Promise.resolve({ error: null });
    }),
  };

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === "workspace_members") return membersBuilder;
        if (table === "workspaces") return workspacesBuilder;
        if (table === "notifications") return notificationsBuilder;
        throw new Error(`Unexpected table ${table}`);
      }),
    },
    notificationInserts,
  };
}

describe("fanoutTaskCompletedNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifies other workspace members and excludes the actor", async () => {
    const { client, notificationInserts } = createMockSupabase([
      {
        user_id: "user-you",
        profiles: {
          full_name: "You",
          email: "you@example.com",
          notification_prefs: { types: { activity: { inApp: true, email: false } } },
        },
      },
      {
        user_id: "user-rachel",
        profiles: {
          full_name: "Rachel Farrar",
          email: "rachel@example.com",
          notification_prefs: { types: { activity: { inApp: true, email: false } } },
        },
      },
    ]);

    await fanoutTaskCompletedNotifications({
      supabase: client,
      workspaceId: "ws-home",
      taskId: "task-1",
      taskTitle: "Take out trash",
      completedAt: "2026-07-26T12:00:00.000Z",
      actorUserId: "user-you",
    });

    expect(notificationInserts).toHaveLength(1);
    const payload = notificationInserts[0] as {
      user_id: string;
      type: string;
      title: string;
      message: string;
      metadata: Record<string, unknown>;
    };
    expect(payload.user_id).toBe("user-rachel");
    expect(payload.type).toBe("activity");
    expect(payload.title).toBe("Task completed");
    expect(payload.message).toContain("You");
    expect(payload.message).toContain("Take out trash");
    expect(payload.metadata.event).toBe("task_completed");
    expect(payload.metadata.task_id).toBe("task-1");
  });

  it("skips demo workspaces", async () => {
    const { client, notificationInserts } = createMockSupabase([]);
    await fanoutTaskCompletedNotifications({
      supabase: client,
      workspaceId: "w1",
      taskId: "task-1",
      taskTitle: "Demo",
      actorUserId: "user-a",
    });
    expect(notificationInserts).toHaveLength(0);
  });
});
