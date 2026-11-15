import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/auth/guard";
import { OAUTH_COOKIE, authConfig, base64url, githubAuthorizeUrl, newPkce } from "@/lib/auth/oidc";
import { allow } from "@/lib/auth/rate-limit";
import { resolveNextPath } from "@/lib/auth/redirect";
import { COOKIE_OPTIONS } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

export function GET(request: NextRequest) {
  const { appUrl }= authConfig();
  if (!allow(`github-signin:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.redirect(new URL("/login?error=rate_limited", appUrl));
  }

  const params= request.nextUrl.searchParams;
  const intent= params.get("intent") === "signup" ? "signup" : "login";
  const next= resolveNextPath(params.get("next"), appUrl);
  const { verifier, challenge, state }= newPkce();

  const response= NextResponse.redirect(githubAuthorizeUrl({ challenge, state }));
  response.cookies.set(OAUTH_COOKIE, base64url(JSON.stringify({ verifier, state, next, intent })), {
    ...COOKIE_OPTIONS,
    path: "/api/auth",
    maxAge: 600,
  });
  return response;
}
