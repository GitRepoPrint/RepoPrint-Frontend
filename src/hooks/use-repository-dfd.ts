import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import type { DfdModel } from "@/lib/api/types";
import { BACKEND_URL } from "@/lib/config";
import { getDetail, peekDetail } from "@/lib/dfd/detail-cache";
import { getOverview } from "@/lib/dfd/overview/get-overview";
import { overviewView } from "@/lib/dfd/project";
import type { DfdGraph } from "@/lib/dfd/schema";
import { graphToDfdModel } from "@/lib/dfd/to-model";

export type RepositoryDfd =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; model: DfdModel; graph: DfdGraph; partial: boolean; cached: boolean; fetchedAt: string };

/** O grafo ao nível do código, que só se pede quando o utilizador quer (lê o repositório inteiro, demora). */
export type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; graph: DfdGraph };

/**
 * O DFD de um repositório, inferido no navegador a partir da configuração que ele tem no GitHub (compose, Dockerfiles,
 * manifestos). Sem servidor nosso: os pedidos vão direitos ao GitHub e o resultado fica 10 minutos no localStorage.
 *
 * Se o backend de análise de código estiver configurado (NEXT_PUBLIC_BACKEND_URL), `loadDetail` pede-lhe o grafo ao nível
 * do código, para juntar ao anterior (ver combineGraphs).
 */
export function useRepositoryDfd(repository: string) {
  const [dfd, setDfd] = useState<RepositoryDfd>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<DetailState>(() => {
    const [owner, repo] = repository.split("/");
    const cached = BACKEND_URL ? peekDetail(owner, repo) : null;
    return cached ? { status: "ready", graph: cached } : { status: "idle" };
  });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const startDetail = useCallback((owner: string, repo: string) => {
    if (!BACKEND_URL) return;
    setDetail({ status: "loading" });
    getDetail(owner, repo, { backendUrl: BACKEND_URL })
      .then((graph) => alive.current && setDetail({ status: "ready", graph }))
      .catch((error: unknown) => {
        console.error("Code analysis failed", error);
        if (alive.current) setDetail({ status: "error", message: errorMessage(error, "The code analysis failed. Please try again.") });
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const [owner, repo] = repository.split("/");
    getOverview(owner, repo)
      .then((data) => {
        if (cancelled) return;
        setDfd({ status: "ready", model: graphToDfdModel(overviewView(data.graph)), graph: data.graph, partial: data.partial, cached: data.cached, fetchedAt: data.fetchedAt });
        // Sem compose, Dockerfiles nem manifestos de serviços a configuração quase nada diz (um só componente): o que
        // mostra a arquitetura é o código, por isso pede-se já, em vez de esperar que o utilizador carregue no botão.
        if (data.graph.meta.fallback === "application" && !peekDetail(owner, repo)) startDetail(owner, repo);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("DFD overview failed", error);
        setDfd({ status: "error", message: errorMessage(error, "The diagram could not be inferred. Please try again.") });
      });
    return () => {
      cancelled = true;
    };
  }, [repository, attempt, startDetail]);

  const retry = useCallback(() => {
    setDfd({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const loadDetail = useCallback(() => {
    const [owner, repo] = repository.split("/");
    startDetail(owner, repo);
  }, [repository, startDetail]);

  return { dfd, retry, detail, loadDetail, detailAvailable: BACKEND_URL !== null };
}
