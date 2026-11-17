import { NextResponse } from "next/server";
import { analyzeLinddun, toFrontendFindings } from "../../../lib/linddun";

/**
 * Serverless Route Handler para análise de ameaças LINDDUN.
 * Compatível com o endpoint /linddun/analyze do RepoPrint-Backend.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "O corpo do pedido tem de conter um objeto DFD válido." },
        { status: 400 }
      );
    }

    const report = analyzeLinddun(body);

    // Se o cliente pedir formato frontend (ex: ?format=frontend), devolve com Findings mapeados
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "frontend") {
      return NextResponse.json({
        ...report,
        frontendFindings: toFrontendFindings(report),
      });
    }

    return NextResponse.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar análise LINDDUN";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "RepoPrint LINDDUN Serverless Engine",
    framework: "LINDDUN",
    description: "Análise declarativa e stateless de privacidade para Data Flow Diagrams (DFD)",
  });
}
