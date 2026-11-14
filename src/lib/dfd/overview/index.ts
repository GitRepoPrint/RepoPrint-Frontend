import type { DfdGraph } from "../schema";
import { buildOverview } from "./build";
import { fetchOverviewFiles } from "./fetch";
import type { FetchOptions } from "./fetch";

export interface OverviewResult {
  graph: DfdGraph;
  /** Faltam ficheiros: a lista do GitHub veio cortada ou alguns não se descarregaram. */
  partial: boolean;
}

/** Overview de um repositório público: descarrega a configuração e constrói o grafo. Corre no navegador ou na extensão. */
export async function analyzeOverview(owner: string, repo: string, options: FetchOptions = {}): Promise<OverviewResult> {
  const { files, truncated, skipped } = await fetchOverviewFiles(owner, repo, options);
  return { graph: buildOverview({ owner, repo, files }), partial: truncated || skipped.length > 0 };
}

export { buildOverview } from "./build";
export type { OverviewInput } from "./build";
