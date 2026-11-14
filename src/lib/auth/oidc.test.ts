import { beforeEach, describe, expect, it, vi } from "vitest";
import { passwordGrant, refreshTokens } from "./oidc";

const TOKENS= { access_token: "a", refresh_token: "r", expires_in: 300, refresh_expires_in: 1800 };

function reply(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubEnv("KEYCLOAK_CLIENT_SECRET", "client-secret");
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "admin-secret");
  vi.stubEnv("KEYCLOAK_URL", "http://kc/realms/repoprint");
});

describe("passwordGrant", () => {
  it("returns the tokens with absolute expiry times", async () => {
    const result= await passwordGrant("ana", "pw", reply(200, TOKENS));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokens.accessToken).toBe("a");
      expect(result.tokens.accessExpiresAt).toBeGreaterThan(Date.now());
      expect(result.tokens.refreshExpiresAt).toBeGreaterThan(result.tokens.accessExpiresAt);
    }
  });

  it("sends the password grant with the client credentials to the realm", async () => {
    const fetcher= reply(200, TOKENS);
    await passwordGrant("ana", "pw", fetcher);

    const [url, init]= vi.mocked(fetcher).mock.calls[0];
    const body= new URLSearchParams(String(init?.body));
    expect(url).toBe("http://kc/realms/repoprint/protocol/openid-connect/token");
    expect(Object.fromEntries(body)).toMatchObject({
      grant_type: "password",
      username: "ana",
      password: "pw",
      client_id: "repoprint-frontend",
      client_secret: "client-secret",
    });
  });

  it("maps wrong credentials to invalid", async () => {
    const result= await passwordGrant("ana", "x", reply(401, { error: "invalid_grant", error_description: "Invalid user credentials" }));

    expect(result).toEqual({ ok: false, error: "invalid" });
  });

  it("treats the lockout answer like wrong credentials", async () => {
    const result= await passwordGrant("ana", "x", reply(400, { error: "invalid_grant", error_description: "Invalid user credentials" }));

    expect(result).toEqual({ ok: false, error: "invalid" });
  });

  it("maps server errors and network failures to unavailable", async () => {
    const down= vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    expect(await passwordGrant("ana", "x", reply(503, {}))).toEqual({ ok: false, error: "unavailable" });
    expect(await passwordGrant("ana", "x", down)).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("refreshTokens", () => {
  it("returns null when the refresh token is rejected", async () => {
    expect(await refreshTokens("old", reply(400, { error: "invalid_grant" }))).toBeNull();
  });

  it("returns the new tokens", async () => {
    expect((await refreshTokens("old", reply(200, TOKENS)))?.accessToken).toBe("a");
  });
});
