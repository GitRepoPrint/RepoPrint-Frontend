import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/auth/backend";
import { activeSession, clearSession } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

type Profile= { email: string; name: string | null; role: string | null };

export async function GET() {
  const session= await activeSession();
  if (session.status !== "active") return NextResponse.json({ authenticated: false, expired: session.status === "expired" });

  const response= await backendFetch("/me", session.accessToken).catch(() => null);
  if (response?.status === 401) {
    await clearSession();
    return NextResponse.json({ authenticated: false, expired: true });
  }
  const user= response?.ok ? ((await response.json()) as Profile) : null;
  return NextResponse.json({ authenticated: true, expired: false, user });
}
