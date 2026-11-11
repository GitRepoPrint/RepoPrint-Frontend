import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie mock definido em lib/auth/auth-provider.tsx ("GitHub" | "RepoPrint").
// No Next.js 16+ este ficheiro chama-se proxy.ts e a função exportada chama-se `proxy`.
export function proxy(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get("rp_session")?.value);
  const { pathname } = req.nextUrl;

  // Quem já tem sessão não precisa de ver a landing, o login nem o registo: vai para os repositórios.
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return hasSession ? NextResponse.redirect(new URL("/repositories", req.url)) : NextResponse.next();
  }

  // Área protegida: sem sessão vai para o login e guarda o destino em ?next=
  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/signup", "/repositories/:path*"] };
