// O DFD ao nível do código vem do backend (GET /dfd), que lê o repositório inteiro. Aqui só se pede, se confere a forma da
// resposta e se traduzem os erros: as mensagens do backend estão em português e não são para mostrar ao utilizador.
import { ApiError } from "@/lib/api/errors";
import type { Fetcher } from "@/lib/github/activity";
import { isStage } from "@/lib/progress";
import type { LoadProgress } from "@/lib/progress";
import { isDfdGraph } from "./schema";
import type { DfdGraph } from "./schema";

/** Ler e analisar um repositório grande leva tempo. */
export const DETAIL_TIMEOUT_MS = 120_000;

/** Com o avanço a chegar, só se desiste se o backend ficar calado este tempo (um repositório grande demora, mas vai avisando). */
export const DETAIL_IDLE_TIMEOUT_MS = 90_000;

export interface DetailOptions {
  backendUrl: string;
  fetcher?: Fetcher;
  /** "directory" (por defeito) agrupa por pasta; "file" por ficheiro. */
  groupBy?: "directory" | "file";
  timeoutMs?: number;
  /** Se existir, a análise vem em fluxo (GET /dfd/stream) e isto é chamado a cada passo: para mostrar o progresso a sério. */
  onProgress?: (progress: LoadProgress) => void;
  idleTimeoutMs?: number;
}

const BY_STATUS: Record<number, string> = {
  400: "That does not look like a public GitHub repository address.",
  404: "The code analysis could not find this repository. It may not exist or may be private (only public repositories are read).",
  413: "This repository is too large for the code analysis.",
  // 429: o limite de pedidos do próprio serviço (por cliente) ou o do GitHub; para o utilizador é a mesma coisa
  429: "The code analysis is rate-limited right now (too many requests, or GitHub's own limit). Try again in a few minutes.",
  503: "The code analysis is busy with other repositories. Try again in a minute.",
};

const errorForStatus = (status: number) =>
  new ApiError(BY_STATUS[status] ?? "The code analysis failed. Please try again.", status >= 500 && status !== 503 ? 502 : status);

export const APP_NOT_INSTALLED="Install the RepoPrint app to read this private repository.";

async function failureOf(response: Response): Promise<ApiError> {
  if (response.status === 404) {
    try {
      const body= (await response.json()) as { detail?: { code?: unknown } } | null;
      if (body?.detail?.code === "app_not_installed") return new ApiError(APP_NOT_INSTALLED, 404);
    } catch {
      /* cai na mensagem por estado */
    }
  }
  return errorForStatus(response.status);
}

const UNEXPECTED = "The code analysis returned something unexpected.";
const UNREACHABLE = "The code analysis service could not be reached.";
const TOO_LONG = "The code analysis took too long. The repository may be very large.";

const isTimeout = (error: unknown) => error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");

/** Um evento do fluxo (uma linha de JSON). O que não se percebe ignora-se: o backend pode vir a acrescentar eventos. */
function parseEvent(line: string): { progress: LoadProgress } | { graph: DfdGraph } | { status: number } | null {
  let event: unknown;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof event !== "object" || event === null) return null;
  const e = event as Record<string, unknown>;
  if (e.type === "progress" && isStage(e.stage) && typeof e.done === "number" && typeof e.total === "number") {
    return { progress: { stage: e.stage, done: e.done, total: e.total } };
  }
  if (e.type === "result") {
    if (!isDfdGraph(e.graph) || e.graph.level !== "detail") throw new ApiError(UNEXPECTED, 502);
    return { graph: e.graph };
  }
  if (e.type === "error") return { status: typeof e.status === "number" ? e.status : 502 };
  return null;
}

async function fetchDetailStream(owner: string, repo: string, options: DetailOptions): Promise<DfdGraph> {
  const fetcher: Fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const query = new URLSearchParams({ url: `https://github.com/${owner}/${repo}`, group_by: options.groupBy ?? "directory" });
  const idleMs = options.idleTimeoutMs ?? DETAIL_IDLE_TIMEOUT_MS;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const rearm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(new DOMException("idle", "TimeoutError")), idleMs);
  };

  try {
    rearm();
    let response: Response;
    try {
      // Só o cabeçalho que não pede um pedido de verificação prévio ao navegador
      response = await fetcher(`${options.backendUrl}/dfd/stream?${query}`, { headers: { Accept: "application/x-ndjson" }, signal: controller.signal });
    } catch (error) {
      throw new ApiError(isTimeout(error) ? TOO_LONG : UNREACHABLE, 503);
    }
    if (!response.ok) throw await failureOf(response);
    if (!response.body) throw new ApiError(UNEXPECTED, 502);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const handle = (line: string): DfdGraph | null => {
      if (!line.trim()) return null;
      const event = parseEvent(line);
      if (!event) return null;
      if ("progress" in event) options.onProgress?.(event.progress);
      else if ("graph" in event) return event.graph;
      else throw errorForStatus(event.status);
      return null;
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        rearm();
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const graph = handle(buffer.slice(0, newline));
          if (graph) return graph;
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
        }
        if (done) break;
      }
      const graph = handle(buffer); // a última linha pode vir sem o "\n" final
      if (graph) return graph;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(isTimeout(error) ? TOO_LONG : "The code analysis was interrupted.", 503);
    } finally {
      reader.cancel().catch(() => {});
    }
    throw new ApiError("The code analysis was interrupted.", 503);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchDetailGraph(owner: string, repo: string, options: DetailOptions): Promise<DfdGraph> {
  if (options.onProgress) return fetchDetailStream(owner, repo, options);
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
  if (!response.ok) throw await failureOf(response);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("The code analysis returned something unexpected.", 502);
  }
  if (!isDfdGraph(body) || body.level !== "detail") throw new ApiError("The code analysis returned something unexpected.", 502);
  return body;
}
