import { mockAnalysis } from "./mock/analysis";
import type { RepositoryAnalysis } from "./types";

/**
 * Análise de um repositório associado. Hoje devolve um mock; mais tarde passa a chamar o backend (mesma assinatura).
 * Com backend: devolver null quando o repositório não existe (404), para a página mostrar o "not found";
 * qualquer outra falha deve lançar um erro, que é apanhado por app/repositories/error.tsx.
 */
export async function getRepositoryAnalysis(repository: string): Promise<RepositoryAnalysis | null> {
  return { ...mockAnalysis, repository };
}
