import { NextResponse } from "next/server";
import { authConfig, endSession } from "@/lib/auth/oidc";
import { clearSession, readSession } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

export async function POST() {
  const tokens= await readSession();
  if (tokens) await endSession(tokens.refreshToken);
  await clearSession();
  return NextResponse.redirect(new URL("/", authConfig().appUrl), 303);
}
