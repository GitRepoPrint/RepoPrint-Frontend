import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { backendFetch } from "@/lib/auth/backend";
import { OAUTH_COOKIE, SESSION_COOKIE, authConfig, exchangeCode } from "@/lib/auth/oidc";
import { resolveNextPath } from "@/lib/auth/redirect";
import { encodeSession, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

type Pending= { verifier: string; state: string; next: string; intent: "login" | "signup" };

function readPending(raw: string | undefined): Pending | null {
  if (!raw) return null;
  try {
    const value= JSON.parse(Buffer.from(raw, "base64url").toString());
    const valid= [value.verifier, value.state, value.next].every((part) => typeof part === "string") && ["login", "signup"].includes(value.intent);
    return valid ? (value as Pending) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { appUrl }= authConfig();
  const fail= (reason: string) => {
    const response= NextResponse.redirect(new URL(`/login?error=${reason}`, appUrl));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  };

  const params= request.nextUrl.searchParams;
  if (params.get("error")) return fail("github_failed");

  const pending= readPending(request.cookies.get(OAUTH_COOKIE)?.value);
  const code= params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) return fail("github_failed");

  const grant= await exchangeCode(code, pending.verifier);
  if (!grant.ok) return fail("github_failed");

  const finished= await backendFetch("/github/signin/finish", grant.tokens.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: pending.intent }),
  }).catch(() => null);
  if (finished?.status === 404) return fail("github_no_account");
  if (!finished?.ok) return fail("github_failed");

  const { connected }= (await finished.json()) as { created: boolean; connected: boolean };
  const destination= connected ? resolveNextPath(pending.next, appUrl) : "/api/github/connect";
  const response= NextResponse.redirect(new URL(destination, appUrl));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  response.cookies.set(SESSION_COOKIE, encodeSession(grant.tokens), sessionCookieOptions(grant.tokens));
  return response;
}
