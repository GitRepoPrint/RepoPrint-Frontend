import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { backendFetch } from "@/lib/auth/backend";
import { activeSession, clearSession } from "@/lib/auth/session";

export const dynamic= "force-dynamic";

const FORWARDED_HEADERS= ["content-type", "accept"];

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const session= await activeSession();
  if (session.status !== "active") return NextResponse.json({ detail: "Sessão necessária" }, { status: 401 });

  const { path }= await context.params;
  const headers= new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value= request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody= request.method !== "GET" && request.method !== "HEAD";
  const target= `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream= await backendFetch(target, session.accessToken, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
  } catch {
    return NextResponse.json({ detail: "Backend indisponível" }, { status: 502 });
  }
  if (upstream.status === 401) await clearSession();

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
