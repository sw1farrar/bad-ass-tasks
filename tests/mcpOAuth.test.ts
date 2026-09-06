import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authorizationServerMetadata,
  consumeAuthCode,
  consumeRefreshToken,
  createAuthCode,
  createTokenPair,
  GROK_REDIRECT_URI,
  parseAuthorizationRequest,
  protectedResourceMetadata,
  registerGrokClient,
  validateScope,
  verifyAccessToken,
  verifyAuthCode,
  verifyPkce,
  verifyRefreshToken,
} from "@/lib/mcp/oauth";
import { __resetMemoryOAuthTicketsForTests } from "@/lib/mcp/ticketStore";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function pkcePair() {
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

describe("mcp oauth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_BASE_URL: "https://badazztasks.com",
      MCP_OAUTH_SECRET: "mcp-oauth-test-secret-value-32ch",
      NODE_ENV: "test",
    };
    __resetMemoryOAuthTicketsForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    __resetMemoryOAuthTicketsForTests();
  });

  it("advertises Grok discovery endpoints on the public origin", () => {
    expect(authorizationServerMetadata()).toMatchObject({
      issuer: "https://badazztasks.com",
      authorization_endpoint: "https://badazztasks.com/oauth/authorize",
      token_endpoint: "https://badazztasks.com/oauth/token",
      registration_endpoint: "https://badazztasks.com/oauth/register",
      code_challenge_methods_supported: ["S256"],
    });
    expect(protectedResourceMetadata()).toMatchObject({
      resource: "https://badazztasks.com/api/mcp",
      authorization_servers: ["https://badazztasks.com"],
    });
  });

  it("accepts default and grok scopes", () => {
    expect(validateScope(null)).toContain("mcp:tools");
    expect(validateScope("mcp:tools openid offline_access")).toBe("mcp:tools openid offline_access");
  });

  it("rejects unknown scopes", () => {
    expect(() => validateScope("admin")).toThrow("invalid_scope");
  });

  it("registers only the official Grok callback", () => {
    const registered = registerGrokClient({
      client_name: "Grok",
      redirect_uris: [GROK_REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
    expect(registered.client_id).toBe("grok");
    expect(() =>
      registerGrokClient({
        redirect_uris: ["https://evil.example/callback"],
      }),
    ).toThrow("invalid_redirect_uri");
  });

  it("parses a Grok authorization request", () => {
    const { challenge } = pkcePair();
    const request = parseAuthorizationRequest(
      new URLSearchParams({
        client_id: "grok",
        redirect_uri: GROK_REDIRECT_URI,
        response_type: "code",
        scope: "mcp:tools",
        state: "abc",
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    );
    expect(request.client_id).toBe("grok");
    expect(request.state).toBe("abc");
  });

  it("issues a one-time authorization code bound to the user", async () => {
    const { verifier, challenge } = pkcePair();
    const code = await createAuthCode({
      client_id: "grok",
      redirect_uri: GROK_REDIRECT_URI,
      state: "s",
      scope: "mcp:tools",
      code_challenge: challenge,
      userId: USER_ID,
    });
    const claims = await verifyAuthCode(code);
    expect(claims.sub).toBe(USER_ID);
    expect(await verifyPkce(verifier, claims.code_challenge)).toBe(true);
    await consumeAuthCode(claims.jti);
    await expect(consumeAuthCode(claims.jti)).rejects.toThrow("invalid_grant");
  });

  it("mints access tokens that identify the authorizing user", async () => {
    const tokens = await createTokenPair({
      clientId: "grok",
      scope: "mcp:tools mcp:write",
      userId: USER_ID,
    });
    const access = verifyAccessToken(tokens.access_token);
    expect(access.userId).toBe(USER_ID);
    expect(access.scopes).toContain("mcp:tools");
  });

  it("rotates refresh tokens and rejects replay", async () => {
    const tokens = await createTokenPair({
      clientId: "grok",
      scope: "mcp:tools",
      userId: USER_ID,
    });
    const refresh = await verifyRefreshToken(tokens.refresh_token);
    await consumeRefreshToken(refresh.jti);
    await expect(consumeRefreshToken(refresh.jti)).rejects.toThrow("invalid_grant");
  });
});
