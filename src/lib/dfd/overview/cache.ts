// Cache do overview no localStorage. A API do GitHub dá 60 pedidos por hora a quem não tem sessão, e cada overview
// gasta um: sem cache, voltar ao separador chegava para esgotar o limite.
import type { KeyValueStorage } from "@/lib/github/activity-cache";
import { isDfdGraph } from "../schema";
import type { DfdGraph } from "../schema";

export const OVERVIEW_TTL_MS = 10 * 60 * 1000;
const VERSION = 1;

interface Entry {
  version: number;
  fetchedAt: number;
  graph: DfdGraph;
}

const keyFor = (owner: string, repo: string) => `repoprint:overview:${owner}/${repo}`.toLowerCase();

/** O grafo guardado, se existir, estiver dentro do prazo e ainda tiver a forma certa (um grafo estragado conta como não haver). */
export function readOverviewCache(storage: KeyValueStorage, owner: string, repo: string, now: number): Entry | null {
  const key = keyFor(owner, repo);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<Entry>;
    if (entry.version !== VERSION || typeof entry.fetchedAt !== "number" || !isDfdGraph(entry.graph)) {
      storage.removeItem(key);
      return null;
    }
    if (now - entry.fetchedAt >= OVERVIEW_TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return entry as Entry;
  } catch {
    return null;
  }
}

export function writeOverviewCache(storage: KeyValueStorage, owner: string, repo: string, graph: DfdGraph, now: number): void {
  const entry: Entry = { version: VERSION, fetchedAt: now, graph };
  try {
    storage.setItem(keyFor(owner, repo), JSON.stringify(entry));
  } catch {
    return; // sem espaço ou sem armazenamento: só se perde a cache
  }
}
