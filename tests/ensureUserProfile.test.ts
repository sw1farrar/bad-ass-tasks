import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUserById = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
const mockAdminClient = {
  auth: { admin: { getUserById: mockGetUserById } },
  from: mockFrom,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => mockAdminClient,
}));

import { ensureUserProfile } from "@/lib/invite/ensureUserProfile";

describe("ensureUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("upserts profile with provided email", async () => {
    await ensureUserProfile("user-1", "Alex@Example.com");

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockUpsert).toHaveBeenCalledWith(
      { id: "user-1", email: "Alex@Example.com" },
      { onConflict: "id" },
    );
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("loads email from auth admin when not provided", async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "loaded@example.com" } },
      error: null,
    });

    await ensureUserProfile("user-2");

    expect(mockGetUserById).toHaveBeenCalledWith("user-2");
    expect(mockUpsert).toHaveBeenCalledWith(
      { id: "user-2", email: "loaded@example.com" },
      { onConflict: "id" },
    );
  });

  it("throws when profile upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "upsert failed" } });

    await expect(ensureUserProfile("user-3", "x@y.com")).rejects.toThrow("upsert failed");
  });
});