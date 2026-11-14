import type { Fetcher } from "@/lib/github/activity";
import type { KeyValueStorage } from "@/lib/github/activity-cache";
import type { DfdGraph } from "../schema";
import { OVERVIEW_TTL_MS, readOverviewCache, writeOverviewCache } from "./cache";
import { analyzeOverview } from "./index";

export interface OverviewData {
  graph: DfdGraph;
  /** Faltam ficheiros: o desenho pode estar incompleto. */
  partial: boolean;
  fetchedAt: string;
  refreshAvailableAt: string;
  cached: boolean;
}

type Options = { fetcher?: Fetcher; storage?: KeyValueStorage | null; clock?: () => number };

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const result = (graph: DfdGraph, partial: boolean, fetchedAt: number, cached: boolean): OverviewData => ({
  graph,
  partial,
  cached,
  fetchedAt: new Date(fetchedAt).toISOString(),
  refreshAvailableAt: new Date(fetchedAt + OVERVIEW_TTL_MS).toISOString(),
});

/** O overview de um repositório: da cache se for recente, senão descarrega a configuração e constrói o grafo. */
export async function getOverview(owner: string, repo: string, options: Options = {}): Promise<OverviewData> {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = (options.clock ?? Date.now)();

  const hit = storage ? readOverviewCache(storage, owner, repo, now) : null;
  if (hit) return result(hit.graph, false, hit.fetchedAt, true);

  const { graph, partial } = await analyzeOverview(owner, repo, { fetcher: options.fetcher });
  // Um resultado incompleto não se guarda: voltar a pedir pode ir buscar o que faltou
  if (storage && !partial) writeOverviewCache(storage, owner, repo, graph, now);
  return result(graph, partial, now, false);
}
