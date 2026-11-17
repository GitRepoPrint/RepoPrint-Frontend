"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, type ComponentProps } from "react";
import { FocusBar } from "@/components/dfd/focus-bar";
import { Icon } from "@/components/ui/icon";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { useDfdFocus } from "@/hooks/use-dfd-focus";
import { useRepositoryDfd } from "@/hooks/use-repository-dfd";
import { isDemoRepository } from "@/lib/api/repositories";
import { combineGraphs } from "@/lib/dfd/combine";
import { graphToDfdModel } from "@/lib/dfd/to-model";
import { describeProgress, stepStates } from "@/lib/progress";
import type { CanvasView as CanvasViewType } from "./canvas-view";

// O canvas só é renderizado no browser (sem SSR):
// - o React Flow precisa de medir os nós no DOM antes de os mostrar, por isso o HTML do servidor não serve para nada;
// - o diagrama guardado vive no localStorage, que só existe no cliente. Sem SSR pode ser lido logo no estado inicial,
//   sem mostrar primeiro o diagrama da análise e depois trocá-lo.
// `ssr: false` só é permitido num Client Component, por isso este ficheiro existe (a página é um Server Component).
const CanvasView = dynamic(() => import("./canvas-view").then((m) => m.CanvasView), {
  ssr: false,
  loading: () => <div className="canvas-app h-[calc(100vh-72px)]!" aria-busy="true" />,
});

type CanvasLoaderProps = Omit<ComponentProps<typeof CanvasViewType>, "live">;

export function CanvasLoader(props: CanvasLoaderProps) {
  // Os repositórios de demonstração não existem no GitHub: mantêm o diagrama de demonstração.
  if (isDemoRepository(props.analysis.repository)) return <CanvasView {...props} live={false} />;
  return <LiveCanvas {...props} />;
}

/** Para um repositório real, o diagrama é o inferido dele (configuração e, com o serviço de análise, código). */
function LiveCanvas({ analysis, branch }: CanvasLoaderProps) {
  const { dfd, retry, detail, loadDetail, detailAvailable } = useRepositoryDfd(analysis.repository);

  // Com o serviço de análise de código configurado, a vista completa usa o detalhe: o overview com tudo aberto.
  // Sem ele (ou se falhar) fica o overview, que é o que a configuração mostra.
  useEffect(() => {
    if (dfd.status === "ready" && detailAvailable && detail.status === "idle") loadDetail();
  }, [dfd.status, detailAvailable, detail.status, loadDetail]);

  // O grafo completo (configuração e, com o serviço de análise, código). O que se vê dele decide-o o foco (use-dfd-focus.ts).
  const graph = useMemo(() => {
    if (dfd.status !== "ready") return null;
    return detail.status === "ready" ? combineGraphs(dfd.graph, detail.graph) : dfd.graph;
  }, [dfd, detail]);
  const focus = useDfdFocus(graph);
  const model = useMemo(() => (graph ? graphToDfdModel(focus.result.view) : null), [graph, focus.result.view]);
  // O React Flow só lê o diagrama inicial uma vez: quando o que se vê muda, desenha-se de novo
  const viewKey = useMemo(() => `${focus.state.mode}:${focus.result.view.nodes.map((n) => n.id).join("|")}`, [focus.state.mode, focus.result.view]);

  const waitingForCode = dfd.status === "ready" && detailAvailable && (detail.status === "idle" || detail.status === "loading");
  if (dfd.status === "ready" && model && !waitingForCode) {
    return <CanvasView key={viewKey} analysis={{ ...analysis, dfd: model }} branch={branch} live fresh={focus.touched} topSlot={<FocusBar focus={focus} />} />;
  }

  const reading = dfd.status === "ready";
  return (
    <div className="canvas-app h-[calc(100vh-72px)]!" aria-busy={dfd.status === "loading" || waitingForCode}>
      <div className="m-6">
        {dfd.status === "error" ? (
          <div className="dfd-state" role="alert">
            <Icon name="warning" size={22} />
            <div><strong>Could not infer the diagram</strong><span>{dfd.message}</span></div>
            <button type="button" className="button button-outline" onClick={retry}>Try again</button>
          </div>
        ) : reading ? (
          <LoadingPanel
            title="Reading the source code"
            detail={detail.status === "loading" && detail.progress ? describeProgress(detail.progress) : "Starting the code analysis…"}
            progress={detail.status === "loading" ? detail.fraction : undefined}
            steps={stepStates(detail.status === "loading" ? detail.progress?.stage : undefined)}
            note="Large repositories can take a minute or two. Only a sample of very large ones is read."
          />
        ) : (
          <LoadingPanel
            title="Inferring the architecture"
            detail={dfd.status === "loading" && dfd.files ? `Reading the configuration · ${dfd.files.done} of ${dfd.files.total} files` : `Looking at the files of ${analysis.repository}…`}
            progress={dfd.status === "loading" && dfd.files ? dfd.fraction : undefined}
          />
        )}
      </div>
    </div>
  );
}
