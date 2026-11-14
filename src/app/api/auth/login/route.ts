import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guard, readJson } from "@/lib/auth/guard";
import { SESSION_COOKIE, authConfig, passwordGrant } from "@/lib/auth/oidc";
import { resolveNextPath } from "@/lib/auth/redirect";
import { encodeSession, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

const STATUS= { invalid: 401, unavailable: 503 } as const;

export async function POST(request: NextRequest) {
  const blocked= guard(request, "login", 30, 60_000);
  if (blocked) return blocked;

  const body= await readJson(request);
  const identifier= typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password= typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password || identifier.length > 255 || password.length > 1024) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const result= await passwordGrant(identifier, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });

  const next= resolveNextPath(typeof body?.next === "string" ? body.next : null, authConfig().appUrl);
  const response= NextResponse.json({ next });
  response.cookies.set(SESSION_COOKIE, encodeSession(result.tokens), sessionCookieOptions(result.tokens));
  return response;
}
