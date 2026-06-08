import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUserById = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpsert = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect, upsert: mockUpsert }));
const mockAdminClient = {
  auth: { admin: { getUserById: mockGetUserById } },
  from: mockFrom,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => mockAdminClient,
}));

import { deriveNameFromEmail, ensureUserProfile } from "@/lib/invite/ensureUserProfile";

describe("deriveNameFromEmail", () => {
  it("formats dotted and underscored local parts", () => {
    expect(deriveNameFromEmail("john.doe@example.com")).toBe("John Doe");
    expect(deriveNameFromEmail("sarah_smith@co.io")).toBe("Sarah Smith");
  });
});

describe("ensureUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("upserts profile with provided email and full name", async () => {
    await ensureUserProfile("user-1", "Alex@Example.com", { fullName: "Alex Rivera" });

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockUpsert).toHaveBeenCalledWith(
      { id: "user-1", email: "Alex@Example.com", full_name: "Alex Rivera" },
      { onConflict: "id" },
    );
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("upserts username and location when provided", async () => {
    await ensureUserProfile("user-1a", "alex@example.com", {
      fullName: "Alex Rivera",
      username: "alexr",
      location: "Austin, TX",
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        id: "user-1a",
        email: "alex@example.com",
        full_name: "Alex Rivera",
        username: "alexr",
        location: "Austin, TX",
      },
      { onConflict: "id" },
    );
  });

  it("derives full_name from email when profile has no name yet", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "user-2", full_name: null }, error: null });

    await ensureUserProfile("user-2", "jane.smith@example.com");

    expect(mockUpsert).toHaveBeenCalledWith(
      { id: "user-2", email: "jane.smith@example.com", full_name: "Jane Smith" },
      { onConflict: "id" },
    );
  });

  it("does not overwrite an existing full_name when none is provided", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "user-3", full_name: "Existing Name" }, error: null });

    await ensureUserProfile("user-3", "x@y.com");

    expect(mockUpsert).toHaveBeenCalledWith(
      { id: "user-3", email: "x@y.com" },
      { onConflict: "id" },
    );
  });

  it("loads email from auth admin when not provided", async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "loaded@example.com" } },
      error: null,
    });

    await ensureUserProfile("user-4");

    expect(mockGetUserById).toHaveBeenCalledWith("user-4");
    expect(mockUpsert).toHaveBeenCalledWith(
      { id: "user-4", email: "loaded@example.com", full_name: "Loaded" },
      { onConflict: "id" },
    );
  });

  it("throws when profile upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "upsert failed" } });

    await expect(ensureUserProfile("user-5", "x@y.com")).rejects.toThrow("upsert failed");
  });
});