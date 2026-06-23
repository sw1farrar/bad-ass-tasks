import { describe, expect, it } from "vitest";
import { getClientIp, getUserAgent } from "@/lib/auth/clientIp";

describe("clientIp", () => {
  it("reads the first forwarded IP", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 70.41.3.18",
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.42" },
    });
    expect(getClientIp(request)).toBe("198.51.100.42");
  });

  it("returns null when no proxy headers exist", () => {
    expect(getClientIp(new Request("https://example.com"))).toBeNull();
  });

  it("reads user agent", () => {
    const request = new Request("https://example.com", {
      headers: { "user-agent": "BadAssTasks/1.0" },
    });
    expect(getUserAgent(request)).toBe("BadAssTasks/1.0");
  });
});