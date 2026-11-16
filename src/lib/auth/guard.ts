import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "./oidc";
import { allow } from "./rate-limit";

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export function guard(request: NextRequest, bucket: string, limit: number, windowMs: number): NextResponse | null {
  if (request.headers.get("origin") !== authConfig().appUrl) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!allow(`${bucket}:${clientIp(request)}`, limit, windowMs)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  return null;
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try {
    const body= await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
