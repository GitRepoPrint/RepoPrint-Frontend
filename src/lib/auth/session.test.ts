import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tokens } from "./oidc";

let cookieValue: string | undefined;
const set= vi.fn();
const remove= vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "rp_session" && cookieValue !== undefined ? { name, value: cookieValue } : undefined),
    set,
    delete: remove,
  }),
}));

const { encodeSession, peekSession }= await import("./session");

const tokens= (accessExpiresAt: number): Tokens => ({
  accessToken: "access",
  refreshToken: "refresh",
  accessExpiresAt,
  refreshExpiresAt: Date.now() + 600_000,
});

beforeEach(() => {
  cookieValue= undefined;
  vi.clearAllMocks();
});

describe("peekSession", () => {
  it("is anonymous without a cookie", async () => {
    expect(await peekSession()).toEqual({ status: "anonymous" });
  });

  it("returns the access token while it is still valid", async () => {
    cookieValue= encodeSession(tokens(Date.now() + 120_000));

    expect(await peekSession()).toEqual({ status: "active", accessToken: "access" });
  });

  it("is stale when the access token is about to expire", async () => {
    cookieValue= encodeSession(tokens(Date.now() + 5_000));

    expect(await peekSession()).toEqual({ status: "stale" });
  });

  it("is stale when the cookie cannot be read", async () => {
    cookieValue= "not-a-session";

    expect(await peekSession()).toEqual({ status: "stale" });
  });

  it("never writes cookies, which Server Components cannot do", async () => {
    cookieValue= encodeSession(tokens(Date.now() - 1000));

    await peekSession();

    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
