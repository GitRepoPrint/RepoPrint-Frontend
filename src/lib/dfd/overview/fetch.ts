// Descarrega do GitHub, direto do navegador, só os ficheiros de configuração de que o overview precisa:
// um pedido à API para a lista de ficheiros e depois cada ficheiro em raw.githubusercontent.com.
// Ambos aceitam pedidos de outras origens (CORS), ao contrário do tarball do backend. Os pedidos a raw.githubusercontent.com
// não levam cabeçalhos próprios, para o navegador não ter de fazer um pedido de verificação prévio.
import { errorFor } from "@/lib/github/activity";
import type { Fetcher } from "@/lib/github/activity";
import { selectConfigFiles } from "./select";
import type { RepoFile } from "./types";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
export const MAX_FILE_BYTES = 200_000;
const CONCURRENCY = 6;

export interface FetchOptions {
  fetcher?: Fetcher;
  maxFileBytes?: number;
}

export interface FetchedRepo {
  files: RepoFile[];
  /** A lista de ficheiros do GitHub veio cortada (repositório enorme): pode faltar configuração. */
  truncated: boolean;
  /** Ficheiros escolhidos que não foi possível descarregar. */
  skipped: string[];
}

interface TreeResponse {
  tree?: { path: string; type: string; size?: number }[];
  truncated?: boolean;
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export async function fetchOverviewFiles(owner: string, repo: string, options: FetchOptions = {}): Promise<FetchedRepo> {
  const fetcher: Fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const maxBytes = options.maxFileBytes ?? MAX_FILE_BYTES;

  const response = await fetcher(`${API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw errorFor(response);
  const body = (await response.json()) as TreeResponse;

  const blobs = (body.tree ?? []).filter((e) => e.type === "blob" && (e.size ?? 0) <= maxBytes).map((e) => e.path);
  const wanted = selectConfigFiles(blobs);

  const files: RepoFile[] = [];
  const skipped: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < wanted.length) {
      const path = wanted[next++];
      try {
        const raw = await fetcher(`${RAW}/${owner}/${repo}/HEAD/${encodePath(path)}`);
        if (raw.ok) files.push({ path, text: await raw.text() });
        else skipped.push(path);
      } catch {
        skipped.push(path);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, worker));

  files.sort((a, b) => wanted.indexOf(a.path) - wanted.indexOf(b.path));
  return { files, truncated: body.truncated === true, skipped };
}
