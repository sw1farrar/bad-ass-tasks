import { describe, expect, it } from "vitest";
import { signHs256Jwt, verifyHs256Jwt } from "@/lib/mcp/jwt";

describe("mcp jwt", () => {
  const secret = "test-secret-value-for-hs256";

  it("round-trips a signed payload", () => {
    const token = signHs256Jwt({ sub: "user-1", typ: "access_token" }, secret);
    expect(verifyHs256Jwt(token, secret).sub).toBe("user-1");
  });

  it("rejects a tampered payload", () => {
    const token = signHs256Jwt({ sub: "user-1" }, secret);
    const [header, body, signature] = token.split(".");
    const tamperedBody = Buffer.from(JSON.stringify({ sub: "user-2" })).toString("base64url");
    expect(() => verifyHs256Jwt(`${header}.${tamperedBody}.${signature}`, secret)).toThrow(
      "invalid_token",
    );
  });

  it("rejects an expired token", () => {
    const token = signHs256Jwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 10 }, secret);
    expect(() => verifyHs256Jwt(token, secret)).toThrow("invalid_token");
  });
});
