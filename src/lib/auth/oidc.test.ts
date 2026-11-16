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

describe("github sign in", () => {
  it("builds a PKCE authorization request that skips the Keycloak login page", async () => {
    vi.stubEnv("APP_URL", "http://app.test");
    vi.stubEnv("KEYCLOAK_PUBLIC_URL", "http://kc.test/realms/repoprint");
    const { githubAuthorizeUrl, newPkce }= await import("./oidc");
    const { challenge, state }= newPkce();

    const url= new URL(githubAuthorizeUrl({ challenge, state }));

    expect(url.origin + url.pathname).toBe("http://kc.test/realms/repoprint/protocol/openid-connect/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "repoprint-frontend",
      redirect_uri: "http://app.test/api/auth/callback",
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      kc_idp_hint: "github",
    });
  });

  it("derives the challenge from the verifier with SHA-256", async () => {
    const { newPkce }= await import("./oidc");
    const { createHash }= await import("node:crypto");
    const { verifier, challenge }= newPkce();

    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("exchanges the code with the verifier on the internal Keycloak address", async () => {
    vi.stubEnv("APP_URL", "http://app.test");
    const { exchangeCode }= await import("./oidc");
    const fetcher= reply(200, TOKENS);

    const result= await exchangeCode("the-code", "the-verifier", fetcher);

    expect(result.ok).toBe(true);
    const [url, init]= vi.mocked(fetcher).mock.calls[0];
    expect(url).toBe("http://kc/realms/repoprint/protocol/openid-connect/token");
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toMatchObject({
      grant_type: "authorization_code",
      code: "the-code",
      code_verifier: "the-verifier",
      redirect_uri: "http://app.test/api/auth/callback",
      client_secret: "client-secret",
    });
  });
});
