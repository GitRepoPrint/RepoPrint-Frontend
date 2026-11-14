// O DFD ao nível do código vem do backend (GET /dfd), que lê o repositório inteiro. Aqui só se pede, se confere a forma da
// resposta e se traduzem os erros: as mensagens do backend estão em português e não são para mostrar ao utilizador.
import { ApiError } from "@/lib/api/errors";
import type { Fetcher } from "@/lib/github/activity";
import { isDfdGraph } from "./schema";
import type { DfdGraph } from "./schema";

/** Ler e analisar um repositório grande leva tempo. */
export const DETAIL_TIMEOUT_MS = 120_000;

export interface DetailOptions {
  backendUrl: string;
  fetcher?: Fetcher;
  /** "directory" (por defeito) agrupa por pasta; "file" por ficheiro. */
  groupBy?: "directory" | "file";
  timeoutMs?: number;
}

const BY_STATUS: Record<number, string> = {
  400: "That does not look like a public GitHub repository address.",
  404: "The code analysis could not find this repository. It may not exist or may be private (only public repositories are read).",
  413: "This repository is too large for the code analysis.",
  429: "GitHub's rate limit was reached while reading the repository. Try again in a few minutes.",
};

const errorForStatus = (status: number) =>
  new ApiError(BY_STATUS[status] ?? "The code analysis failed. Please try again.", status >= 500 ? 502 : status);

export async function fetchDetailGraph(owner: string, repo: string, options: DetailOptions): Promise<DfdGraph> {
  const fetcher: Fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const query = new URLSearchParams({ url: `https://github.com/${owner}/${repo}`, group_by: options.groupBy ?? "directory" });

  let response: Response;
  try {
    response = await fetcher(`${options.backendUrl}/dfd?${query}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? DETAIL_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ApiError(
      timedOut ? "The code analysis took too long. The repository may be very large." : "The code analysis service could not be reached.",
      503,
    );
  }
  if (!response.ok) throw errorForStatus(response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("The code analysis returned something unexpected.", 502);
  }
  if (!isDfdGraph(body) || body.level !== "detail") throw new ApiError("The code analysis returned something unexpected.", 502);
  return body;
}
