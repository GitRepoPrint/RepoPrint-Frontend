import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guard, readJson } from "@/lib/auth/guard";
import { createUser } from "@/lib/auth/keycloak-admin";
import { SESSION_COOKIE, authConfig, passwordGrant } from "@/lib/auth/oidc";
import { resolveNextPath } from "@/lib/auth/redirect";
import { encodeSession, sessionCookieOptions } from "@/lib/auth/session";
import { validateAccount } from "@/lib/auth/validation";

export const dynamic= "force-dynamic";

const CREATE_STATUS= { username_taken: 409, email_taken: 409, password_policy: 400, unavailable: 503 } as const;

export async function POST(request: NextRequest) {
  const blocked= guard(request, "signup", 10, 3_600_000);
  if (blocked) return blocked;

  const body= await readJson(request);
  const account= {
    username: typeof body?.username === "string" ? body.username.trim() : "",
    email: typeof body?.email === "string" ? body.email.trim() : "",
    password: typeof body?.password === "string" ? body.password : "",
  };
  const errors= validateAccount(account);
  if (Object.keys(errors).length > 0 || account.email.length > 255 || account.password.length > 1024) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const created= await createUser(account);
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: CREATE_STATUS[created.error] });

  const result= await passwordGrant(account.username, account.password);
  if (!result.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const next= resolveNextPath(typeof body?.next === "string" ? body.next : null, authConfig().appUrl);
  const response= NextResponse.json({ next }, { status: 201 });
  response.cookies.set(SESSION_COOKIE, encodeSession(result.tokens), sessionCookieOptions(result.tokens));
  return response;
}
