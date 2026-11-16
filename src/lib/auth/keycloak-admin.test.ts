import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, resetAdminToken } from "./keycloak-admin";

const USER= { username: "ana", email: "ana@example.com", password: "uma-password-longa" };

type Reply= { status: number; body?: unknown };

function keycloak(userReplies: Reply[]) {
  const queue= [...userReplies];
  const calls: { url: string; init?: RequestInit }[]= [];
  const fetcher= vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url= String(input);
    calls.push({ url, init });
    if (url.endsWith("/protocol/openid-connect/token")) {
      return new Response(JSON.stringify({ access_token: `admin-${calls.length}`, expires_in: 60 }), { status: 200 });
    }
    const next= queue.shift() ?? { status: 201 };
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

beforeEach(() => {
  resetAdminToken();
  vi.stubEnv("KEYCLOAK_CLIENT_SECRET", "client-secret");
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "admin-secret");
  vi.stubEnv("KEYCLOAK_URL", "http://kc/realms/repoprint");
});

describe("createUser", () => {
  it("creates the user in the realm with a permanent password", async () => {
    const { fetcher, calls }= keycloak([{ status: 201 }]);

    expect(await createUser(USER, fetcher)).toEqual({ ok: true });

    const create= calls.find((call) => call.url.endsWith("/users"))!;
    expect(create.url).toBe("http://kc/admin/realms/repoprint/users");
    expect(JSON.parse(String(create.init?.body))).toMatchObject({
      username: "ana",
      email: "ana@example.com",
      enabled: true,
      credentials: [{ type: "password", value: "uma-password-longa", temporary: false }],
    });
  });

  it("reuses the admin token while it is valid", async () => {
    const { fetcher, calls }= keycloak([{ status: 201 }, { status: 201 }]);

    await createUser(USER, fetcher);
    await createUser({ ...USER, username: "bia" }, fetcher);

    expect(calls.filter((call) => call.url.endsWith("/protocol/openid-connect/token"))).toHaveLength(1);
  });

  it("retries once with a new admin token after a 401", async () => {
    const { fetcher, calls }= keycloak([{ status: 401 }, { status: 201 }]);

    expect(await createUser(USER, fetcher)).toEqual({ ok: true });
    expect(calls.filter((call) => call.url.endsWith("/protocol/openid-connect/token"))).toHaveLength(2);
  });

  it.each([
    [409, "User exists with same username", "username_taken"],
    [409, "User exists with same email", "email_taken"],
    [400, "invalidPasswordMinLengthMessage", "password_policy"],
    [500, "boom", "unavailable"],
  ])("maps %i %s to %s", async (status, message, error) => {
    const body= message.startsWith("invalidPassword") ? { error: message } : { errorMessage: message };
    const { fetcher }= keycloak([{ status, body }]);

    expect(await createUser(USER, fetcher)).toEqual({ ok: false, error });
  });

  it("is unavailable when the admin token cannot be obtained", async () => {
    const fetcher= vi.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;

    expect(await createUser(USER, fetcher)).toEqual({ ok: false, error: "unavailable" });
  });
});
