import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { backendFetch } from "@/lib/auth/backend";
import { authConfig } from "@/lib/auth/oidc";
import { activeSession } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

const RESULTS: Record<number, string>= { 403: "forbidden", 503: "unavailable" };

export async function GET(request: NextRequest) {
  const { appUrl }= authConfig();
  const finish= (result: string) => NextResponse.redirect(new URL(`/repositories?github_app=${result}`, appUrl));

  const params= request.nextUrl.searchParams;
  if (params.get("error")) return finish("denied");
  if (params.get("setup_action") === "request") return finish("requested");
  const code= params.get("code");
  const state= params.get("state");
  const installationId= Number(params.get("installation_id"));
  if (!code || !state || !Number.isSafeInteger(installationId) || installationId <= 0) return finish("error");

  const session= await activeSession();
  if (session.status !== "active") return NextResponse.redirect(new URL("/login?next=/repositories", appUrl));

  const response= await backendFetch("/github/app/callback", session.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state, installation_id: installationId }),
  }).catch(() => null);
  if (response?.ok) return finish("installed");
  return finish(RESULTS[response?.status ?? 0] ?? "error");
}
