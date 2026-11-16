import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { backendFetch } from "@/lib/auth/backend";
import { authConfig } from "@/lib/auth/oidc";
import { activeSession } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

export async function GET(request: NextRequest) {
  const { appUrl }= authConfig();
  const finish= (result: string) => NextResponse.redirect(new URL(`/repositories?github=${result}`, appUrl));

  const params= request.nextUrl.searchParams;
  if (params.get("error")) return finish("denied");
  const code= params.get("code");
  const state= params.get("state");
  if (!code || !state) return finish("error");

  const session= await activeSession();
  if (session.status !== "active") return NextResponse.redirect(new URL("/login?next=/repositories", appUrl));

  const response= await backendFetch("/github/callback", session.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state }),
  }).catch(() => null);
  if (response?.status === 409) return finish("taken");
  return finish(response?.ok ? "connected" : "error");
}
