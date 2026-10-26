import { mockAnalysis } from "./mock/analysis";
import type { RepositoryAnalysis } from "./types";

/** Análise de um repositório associado. Hoje devolve um mock; mais tarde passa a chamar o backend (mesma assinatura). */
export async function getRepositoryAnalysis(repository: string): Promise<RepositoryAnalysis> {
  return { ...mockAnalysis, repository };
}
