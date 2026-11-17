import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/auth/backend";
import { authConfig } from "@/lib/auth/oidc";
import { activeSession } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

export async function GET() {
  const { appUrl }= authConfig();
  const session= await activeSession();
  if (session.status !== "active") return NextResponse.redirect(new URL("/login?next=/repositories", appUrl));

  const response= await backendFetch("/github/connect", session.accessToken).catch(() => null);
  if (!response?.ok) return NextResponse.redirect(new URL("/repositories?github=unavailable", appUrl));

  const { url }= (await response.json()) as { url: string };
  return NextResponse.redirect(url);
}
