import { mockInstantReport } from "./mock/instant-report";
import type { InstantReport } from "./types";

/** Repositório usado quando o campo está vazio (modo demo, como no mockup). */
export const DEFAULT_REPOSITORY = "deti-org/payment-service";

/**
 * Análise instantânea: sem estado, sem autenticação.
 * Hoje devolve um mock; mais tarde passa a chamar o endpoint serverless (mesma assinatura).
 * Com backend: se a resposta não for 2xx, lançar um ApiError (lib/api/errors.ts) com uma mensagem
 * para o utilizador. O InstantAnalyzer apanha qualquer erro e volta ao estado anterior.
 */
export async function analyzeInstant(repository: string): Promise<InstantReport> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { ...mockInstantReport, repository, analyzedAt: new Date().toISOString() };
}
