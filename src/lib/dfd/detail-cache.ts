import type { Fetcher } from "@/lib/github/activity";
import { fetchDetailGraph } from "./detail";
import type { DetailOptions } from "./detail";
import type { DfdGraph } from "./schema";

export const DETAIL_TTL_MS = 10 * 60 * 1000;

interface Entry {
  fetchedAt: number;
  graph: DfdGraph;
}

// Em memória e não no localStorage: um grafo ao nível do código pode ter megabytes, e é caro de calcular, por isso
// dura o que dura a página (ir para outro separador e voltar não o pede outra vez).
const memory = new Map<string, Entry>();
const keyOf = (owner: string, repo: string) => `${owner}/${repo}`.toLowerCase();

export function peekDetail(owner: string, repo: string, now = Date.now()): DfdGraph | null {
  const entry = memory.get(keyOf(owner, repo));
  if (!entry) return null;
  if (now - entry.fetchedAt >= DETAIL_TTL_MS) {
    memory.delete(keyOf(owner, repo));
    return null;
  }
  return entry.graph;
}

export function clearDetailCache() {
  memory.clear();
}

type Options = DetailOptions & { clock?: () => number; fetcher?: Fetcher };

/** O grafo ao nível do código: o que já se tem, ou o que o backend devolver (que fica guardado). */
export async function getDetail(owner: string, repo: string, options: Options): Promise<DfdGraph> {
  const now = (options.clock ?? Date.now)();
  const hit = peekDetail(owner, repo, now);
  if (hit) return hit;
  const graph = await fetchDetailGraph(owner, repo, options);
  memory.set(keyOf(owner, repo), { fetchedAt: now, graph });
  return graph;
}
