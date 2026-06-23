import { describe, it, expect, vi, beforeEach } from "vitest";

const setSession = vi.fn();
const syncAuthFromSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    auth: { setSession },
  }),
}));

vi.mock("@/store/useTaskStore", () => ({
  useTaskStore: {
    getState: () => ({
      user: null,
      syncAuthFromSession,
    }),
  },
}));

import {
  completeClientSignIn,
  completeClientSignInFromSession,
} from "@/lib/auth/completeClientSignIn";

describe("completeClientSignIn", () => {
  beforeEach(() => {
    setSession.mockReset();
    syncAuthFromSession.mockReset();
  });

  it("establishes the client session and syncs auth state", async () => {
    setSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" }, access_token: "a", refresh_token: "r" } },
      error: null,
    });

    const result = await completeClientSignIn({
      access_token: "access",
      refresh_token: "refresh",
    });

    expect(result).toEqual({ ok: true });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(syncAuthFromSession).toHaveBeenCalled();
  });

  it("returns an error when setSession fails", async () => {
    setSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid token" },
    });

    const result = await completeClientSignIn({
      access_token: "bad",
      refresh_token: "bad",
    });

    expect(result).toEqual({ ok: false, error: "Invalid token" });
    expect(syncAuthFromSession).not.toHaveBeenCalled();
  });

  it("accepts a session object from verifyOtp", async () => {
    setSession.mockResolvedValue({
      data: { session: { user: { id: "user-2" }, access_token: "a", refresh_token: "r" } },
      error: null,
    });

    const result = await completeClientSignInFromSession({
      access_token: "access",
      refresh_token: "refresh",
    });

    expect(result).toEqual({ ok: true });
  });
});