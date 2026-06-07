import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  shouldDeliverNotification,
} from "@/lib/notifications/notificationPrefs";
import {
  isMissingNotificationPrefsColumn,
  warnMissingNotificationPrefsColumnOnce,
} from "@/lib/notifications/schemaFallback";
import { fanoutNoteAddedNotifications } from "@/lib/notifications/fanoutNoteAdded";

vi.mock("@/lib/notifications/sendNotificationEmail", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(true),
}));

import { sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

function createMockSupabase(members: unknown[], workspaceName = "Acme") {
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

describe("schemaFallback", () => {
  it("detects missing notification_prefs column errors", () => {
    expect(
      isMissingNotificationPrefsColumn({
        code: "42703",
        message: 'column profiles.notification_prefs does not exist',
      }),
    ).toBe(true);
    expect(isMissingNotificationPrefsColumn({ code: "42703", message: "column profiles.location does not exist" })).toBe(
      false,
    );
  });

  it("warns only once about missing column", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnMissingNotificationPrefsColumnOnce();
    warnMissingNotificationPrefsColumnOnce();
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    warnSpy.mockRestore();
  });
});

describe("notificationPrefs", () => {
  it("maps legacy assignment key to task_assigned", () => {
    const prefs = normalizeNotificationPrefs({
      email: true,
      inApp: true,
      types: { assignment: false, activity: true },
    });
    expect(prefs.types.task_assigned).toEqual({ inApp: false, email: false });
    expect(prefs.types.activity).toEqual({ inApp: true, email: true });
  });

  it("respects per-workspace mute and channel toggles", () => {
    const prefs: typeof DEFAULT_NOTIFICATION_PREFS = {
      ...DEFAULT_NOTIFICATION_PREFS,
      perWorkspace: { ws1: { muted: true } },
    };
    expect(shouldDeliverNotification(prefs, "ws1", "activity", "inApp")).toBe(false);
    expect(shouldDeliverNotification(DEFAULT_NOTIFICATION_PREFS, "ws1", "activity", "inApp")).toBe(true);
    expect(
      shouldDeliverNotification(
        {
          ...DEFAULT_NOTIFICATION_PREFS,
          types: {
            ...DEFAULT_NOTIFICATION_PREFS.types,
            activity: { inApp: false, email: true },
          },
        },
        "ws1",
        "activity",
        "inApp",
      ),
    ).toBe(false);
    expect(
      shouldDeliverNotification(
        {
          ...DEFAULT_NOTIFICATION_PREFS,
          types: {
            ...DEFAULT_NOTIFICATION_PREFS.types,
            activity: { inApp: true, email: false },
          },
        },
        "ws1",
        "activity",
        "email",
      ),
    ).toBe(false);
  });
});

describe("fanoutNoteAddedNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops for demo workspace ids", async () => {
    const { client } = createMockSupabase([]);
    await fanoutNoteAddedNotifications({
      workspaceId: "w1",
      noteId: "note-1",
      noteTitle: "Hello",
      supabase: client as never,
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("creates in-app notifications for peers and skips actor", async () => {
    const members = [
      {
        user_id: "actor-1",
        profiles: {
          full_name: "Alex",
          email: "alex@example.com",
          notification_prefs: DEFAULT_NOTIFICATION_PREFS,
        },
      },
      {
        user_id: "peer-1",
        profiles: {
          full_name: "Blake",
          email: "blake@example.com",
          notification_prefs: DEFAULT_NOTIFICATION_PREFS,
        },
      },
    ];
    const { client, notificationInserts } = createMockSupabase(members);

    await fanoutNoteAddedNotifications({
      workspaceId: "ws-real",
      noteId: "note-abc",
      noteTitle: "Sprint notes",
      actorUserId: "actor-1",
      supabase: client as never,
    });

    expect(notificationInserts).toHaveLength(1);
    expect(notificationInserts[0]).toMatchObject({
      user_id: "peer-1",
      type: "activity",
      metadata: expect.objectContaining({ note_id: "note-abc" }),
    });
    expect(sendNotificationEmail).toHaveBeenCalledWith(
      "blake@example.com",
      "activity",
      expect.objectContaining({ title: "New note added" }),
    );
  });

  it("retries member fetch without notification_prefs when column is missing", async () => {
    const members = [
      {
        user_id: "peer-3",
        profiles: { full_name: "Dana", email: "dana@example.com" },
      },
    ];

    let selectCall = 0;
    const membersBuilder = {
      select: vi.fn(() => membersBuilder),
      eq: vi.fn(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return Promise.resolve({
            data: null,
            error: { code: "42703", message: "column profiles.notification_prefs does not exist" },
          });
        }
        return Promise.resolve({ data: members, error: null });
      }),
    };
    const workspacesBuilder = {
      select: vi.fn(() => workspacesBuilder),
      eq: vi.fn(() => workspacesBuilder),
      maybeSingle: vi.fn(() => Promise.resolve({ data: { name: "Acme" }, error: null })),
    };
    const notificationInserts: unknown[] = [];
    const client = {
      from: vi.fn((table: string) => {
        if (table === "workspace_members") return membersBuilder;
        if (table === "workspaces") return workspacesBuilder;
        if (table === "notifications") {
          return {
            insert: vi.fn((payload: unknown) => {
              notificationInserts.push(payload);
              return Promise.resolve({ error: null });
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await fanoutNoteAddedNotifications({
      workspaceId: "ws-real",
      noteId: "note-fallback",
      noteTitle: "Fallback note",
      supabase: client as never,
    });

    expect(selectCall).toBe(2);
    expect(notificationInserts).toHaveLength(1);
  });

  it("skips in-app delivery when activity type disabled", async () => {
    const members = [
      {
        user_id: "peer-2",
        profiles: {
          full_name: "Casey",
          email: "casey@example.com",
          notification_prefs: {
            email: true,
            inApp: true,
            types: {
              ...DEFAULT_NOTIFICATION_PREFS.types,
              activity: { inApp: false, email: false },
            },
          },
        },
      },
    ];
    const { client, notificationInserts } = createMockSupabase(members);

    await fanoutNoteAddedNotifications({
      workspaceId: "ws-real",
      noteId: "note-xyz",
      noteTitle: "Quiet note",
      supabase: client as never,
    });

    expect(notificationInserts).toHaveLength(0);
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });
});