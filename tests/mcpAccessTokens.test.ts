import { describe, expect, it } from "vitest";
import { hashMcpAccessToken, isMcpAccessToken } from "@/lib/mcp/accessTokens";

describe("mcp access tokens", () => {
  it("recognizes bot tokens without treating OAuth JWTs as PATs", () => {
    expect(isMcpAccessToken("bat_mcp_abc123")).toBe(true);
    expect(
      isMcpAccessToken(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIn0.signature",
      ),
    ).toBe(false);
    expect(isMcpAccessToken("Bearer bat_mcp_abc")).toBe(false);
  });

  it("hashes tokens deterministically", () => {
    const token = "bat_mcp_test-secret";
    expect(hashMcpAccessToken(token)).toBe(hashMcpAccessToken(token));
    expect(hashMcpAccessToken(token)).not.toBe(hashMcpAccessToken("bat_mcp_other"));
  });
});
