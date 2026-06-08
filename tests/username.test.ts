import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeUsername, validateUsername } from "@/lib/profile/username";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockAdminClient = { from: mockFrom };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => mockAdminClient,
}));

import { checkUsernameAvailable } from "@/lib/profile/checkUsernameAvailable";

describe("username helpers", () => {
  it("sanitizes handles", () => {
    expect(sanitizeUsername(" Alex_R ")).toBe("alex_r");
    expect(sanitizeUsername("Bad-Handle!")).toBe("badhandle");
  });

  it("rejects invalid usernames", () => {
    expect(validateUsername("ab").ok).toBe(false);
    expect(validateUsername("1alex").ok).toBe(false);
    expect(validateUsername("alex").ok).toBe(true);
  });
});

describe("checkUsernameAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns available when no profile matches", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await checkUsernameAvailable("newuser");

    expect(result.available).toBe(true);
    expect(result.username).toBe("newuser");
  });

  it("returns taken when profile exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "user-1" }, error: null });

    const result = await checkUsernameAvailable("taken");

    expect(result.available).toBe(false);
    expect(result.error).toMatch(/taken/i);
  });
});