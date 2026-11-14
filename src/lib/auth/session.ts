import { cookies } from "next/headers";
import { SESSION_COOKIE, refreshTokens } from "./oidc";
import type { Tokens } from "./oidc";

const EXPIRY_MARGIN_MS= 10_000;

export const COOKIE_OPTIONS= {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export function encodeSession(tokens: Tokens): string {
  return Buffer.from(JSON.stringify(tokens)).toString("base64url");
}

function decodeSession(raw: string | undefined): Tokens | null {
  if (!raw) return null;
  try {
    const value= JSON.parse(Buffer.from(raw, "base64url").toString());
    const valid=
      typeof value.accessToken === "string" &&
      typeof value.refreshToken === "string" &&
      typeof value.accessExpiresAt === "number" &&
      typeof value.refreshExpiresAt === "number";
    return valid ? (value as Tokens) : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(tokens: Tokens) {
  return { ...COOKIE_OPTIONS, maxAge: Math.max(1, Math.floor((tokens.refreshExpiresAt - Date.now()) / 1000)) };
}

export async function storeSession(tokens: Tokens): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, encodeSession(tokens), sessionCookieOptions(tokens));
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession(): Promise<Tokens | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export type SessionState=
  | { status: "anonymous" }
  | { status: "expired" }
  | { status: "active"; accessToken: string };

export async function activeSession(): Promise<SessionState> {
  const tokens= await readSession();
  if (!tokens) {
    const hadCookie= Boolean((await cookies()).get(SESSION_COOKIE));
    if (hadCookie) await clearSession();
    return { status: hadCookie ? "expired" : "anonymous" };
  }
  if (tokens.accessExpiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return { status: "active", accessToken: tokens.accessToken };
  }
  const renewed= tokens.refreshExpiresAt > Date.now() ? await refreshTokens(tokens.refreshToken) : null;
  if (!renewed) {
    await clearSession();
    return { status: "expired" };
  }
  await storeSession(renewed);
  return { status: "active", accessToken: renewed.accessToken };
}
