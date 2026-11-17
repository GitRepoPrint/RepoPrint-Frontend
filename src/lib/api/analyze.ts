import { getOverview } from "@/lib/dfd/overview/get-overview";

export interface AnalysisResult {
  /** Quando se terminou (ISO 8601). */
  analyzedAt: string;
  /** Faltou alguma coisa: o desenho pode estar incompleto. */
  partial: boolean;
}

type Deps = { getOverview?: typeof getOverview; now?: () => number };

/**
 * Analisa um repositório associado: infere a arquitetura a partir da configuração que ele tem no GitHub. O resultado fica
 * em cache, por isso o dashboard que se abre a seguir já o encontra. Lança um ApiError com mensagem para o utilizador se o
 * repositório não existir, for privado ou o GitHub recusar.
 */
export async function analyzeRepository(name: string, deps: Deps = {}): Promise<AnalysisResult> {
  const [owner, repo] = name.split("/");
  const data = await (deps.getOverview ?? getOverview)(owner, repo);
  return { analyzedAt: new Date((deps.now ?? Date.now)()).toISOString(), partial: data.partial };
}
