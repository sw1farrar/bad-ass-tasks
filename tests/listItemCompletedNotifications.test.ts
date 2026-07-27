import { describe, it, expect, vi, beforeEach } from "vitest";
import { fanoutListItemCompletedNotifications } from "@/lib/notifications/fanoutListItemCompleted";

vi.mock("@/lib/notifications/sendNotificationEmail", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(true),
}));

function createMockSupabase(options: {
  shares: Array<{ source_workspace_id: string; target_workspace_id: string }>;
  membersByWorkspace: Record<string, unknown[]>;
}) {
  const notificationInserts: unknown[] = [];

  const sharesBuilder = {
    select: vi.fn(() => sharesBuilder),
    eq: vi.fn(() => sharesBuilder),
    is: vi.fn(() => Promise.resolve({ data: options.shares, error: null })),
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
        if (table === "workspace_list_shares") return sharesBuilder;
        if (table === "notifications") return notificationsBuilder;
        if (table === "workspace_members") {
          const membersBuilder = {
            select: vi.fn(() => membersBuilder),
            eq: vi.fn((_col: string, workspaceId: string) =>
              Promise.resolve({
                data: options.membersByWorkspace[workspaceId] ?? [],
                error: null,
              }),
            ),
          };
          return membersBuilder;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    },
    notificationInserts,
  };
}

describe("fanoutListItemCompletedNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifies workspace teammates even when the list is not cross-shared", async () => {
    const { client, notificationInserts } = createMockSupabase({
      shares: [],
      membersByWorkspace: {
        "ws-source": [
          {
            user_id: "user-a",
            profiles: {
              full_name: "Alex Actor",
              email: "alex@example.com",
              notification_prefs: { types: { activity: { inApp: true, email: false } } },
            },
          },
          {
            user_id: "user-b",
            profiles: {
              full_name: "Blake",
              email: "blake@example.com",
              notification_prefs: { types: { activity: { inApp: true, email: false } } },
            },
          },
        ],
      },
    });

    await fanoutListItemCompletedNotifications({
      supabase: client,
      workspaceId: "ws-source",
      listId: "list-1",
      listItemId: "item-1",
      itemText: "Milk",
      listTitle: "Groceries",
      actorUserId: "user-a",
    });

    expect(notificationInserts).toHaveLength(1);
    const payload = notificationInserts[0] as {
      user_id: string;
      type: string;
      metadata: Record<string, unknown>;
    };
    expect(payload.user_id).toBe("user-b");
    expect(payload.type).toBe("activity");
    expect(payload.metadata.event).toBe("list_item_completed");
  });

  it("notifies other shared-list collaborators and excludes the actor", async () => {
    const { client, notificationInserts } = createMockSupabase({
      shares: [
        {
          source_workspace_id: "ws-source",
          target_workspace_id: "ws-target",
        },
      ],
      membersByWorkspace: {
        "ws-source": [
          {
            user_id: "user-a",
            profiles: {
              full_name: "Alex Actor",
              email: "alex@example.com",
              notification_prefs: { types: { activity: { inApp: true, email: false } } },
            },
          },
          {
            user_id: "user-b",
            profiles: {
              full_name: "Blake",
              email: "blake@example.com",
              notification_prefs: { types: { activity: { inApp: true, email: false } } },
            },
          },
        ],
        "ws-target": [
          {
            user_id: "user-c",
            profiles: {
              full_name: "Casey",
              email: "casey@example.com",
              notification_prefs: { types: { activity: { inApp: true, email: false } } },
            },
          },
        ],
      },
    });

    await fanoutListItemCompletedNotifications({
      supabase: client,
      workspaceId: "ws-source",
      listId: "list-1",
      listItemId: "item-1",
      itemText: "Milk",
      listTitle: "Groceries",
      completedAt: "2026-07-23T12:00:00.000Z",
      actorUserId: "user-a",
    });

    expect(notificationInserts).toHaveLength(2);
    const payloads = notificationInserts as Array<{
      user_id: string;
      workspace_id: string;
      type: string;
      title: string;
      message: string;
      metadata: Record<string, unknown>;
    }>;

    expect(payloads.every((p) => p.user_id !== "user-a")).toBe(true);
    expect(payloads.map((p) => p.user_id).sort()).toEqual(["user-b", "user-c"]);
    expect(payloads.every((p) => p.type === "activity")).toBe(true);
    expect(payloads.every((p) => p.title === "List item completed")).toBe(true);
    expect(payloads[0].message).toContain("Alex Actor");
    expect(payloads[0].message).toContain("Milk");
    expect(payloads[0].message).toContain("Groceries");
    expect(payloads.every((p) => p.metadata.event === "list_item_completed")).toBe(true);
    expect(payloads.every((p) => p.metadata.list_item_id === "item-1")).toBe(true);
  });
});
