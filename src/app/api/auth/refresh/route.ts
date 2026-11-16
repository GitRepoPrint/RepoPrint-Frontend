import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth/oidc";
import { resolveNextPath } from "@/lib/auth/redirect";
import { activeSession, clearSession } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

export async function GET(request: NextRequest) {
  const { appUrl }= authConfig();
  const params= request.nextUrl.searchParams;
  const next= resolveNextPath(params.get("next"), appUrl);
  const expired= () => NextResponse.redirect(new URL(`/login?error=expired&next=${encodeURIComponent(next)}`, appUrl));

  if (params.get("reason") === "invalid") {
    await clearSession();
    return expired();
  }

  const session= await activeSession();
  return session.status === "active" ? NextResponse.redirect(new URL(next, appUrl)) : expired();
}
