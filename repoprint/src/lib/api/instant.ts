import { mockInstantReport } from "./mock/instant-report";
import type { InstantReport } from "./types";

/** Repositório usado quando o campo está vazio (modo demo, como no mockup). */
export const DEFAULT_REPOSITORY = "deti-org/payment-service";

const GITHUB_REPO =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i;

/** "https://github.com/org/repo/tree/main" -> "org/repo"; devolve null se não for um URL GitHub válido. */
export function parseGithubRepository(input: string): string | null {
  const match = input.trim().match(GITHUB_REPO);
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * Análise instantânea: sem estado, sem autenticação.
 * Hoje devolve um mock; mais tarde passa a chamar o endpoint serverless (mesma assinatura).
 */
export async function analyzeInstant(repository: string): Promise<InstantReport> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { ...mockInstantReport, repository, analyzedAt: new Date().toISOString() };
}
