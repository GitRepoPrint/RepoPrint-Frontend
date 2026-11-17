"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, type ComponentProps } from "react";
import { FocusBar } from "@/components/dfd/focus-bar";
import { Icon } from "@/components/ui/icon";
import { useDfdFocus } from "@/hooks/use-dfd-focus";
import { useRepositoryDfd } from "@/hooks/use-repository-dfd";
import { isDemoRepository } from "@/lib/api/repositories";
import { combineGraphs } from "@/lib/dfd/combine";
import { project } from "@/lib/dfd/project";
import { graphToDfdModel } from "@/lib/dfd/to-model";
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

  const full = useMemo(() => {
    if (dfd.status !== "ready") return null;
    const graph = detail.status === "ready" ? combineGraphs(dfd.graph, detail.graph) : dfd.graph;
    return project(graph, { expanded: "all" });
  }, [dfd, detail]);

  // Tudo aberto pode ser centenas de componentes: por defeito vê-se o fluxo principal (no máximo 10), e os controlos deixam escolher outros.
  const focus = useDfdFocus(full);
  const model = useMemo(() => (full ? graphToDfdModel(focus.result.view) : null), [full, focus.result.view]);
  // O React Flow só lê o diagrama inicial uma vez: quando o que se vê muda, desenha-se de novo
  const viewKey = useMemo(() => `${focus.state.mode}:${focus.result.view.nodes.map((n) => n.id).join("|")}`, [focus.state.mode, focus.result.view]);

  const waitingForCode = dfd.status === "ready" && detailAvailable && (detail.status === "idle" || detail.status === "loading");
  if (dfd.status === "ready" && model && !waitingForCode) {
    return <CanvasView key={viewKey} analysis={{ ...analysis, dfd: model }} branch={branch} live fresh={focus.touched} topSlot={<FocusBar focus={focus} />} />;
  }

  return (
    <div className="canvas-app h-[calc(100vh-72px)]!" aria-busy={dfd.status === "loading" || waitingForCode}>
      <div className="dfd-state m-6" role={dfd.status === "error" ? "alert" : "status"}>
        {dfd.status === "loading" || dfd.status === "ready" ? (
          <>
            <span className="analysis-spinner large" />
            <div><strong>Inferring the architecture</strong><span>{dfd.status === "ready" ? `Reading the source code of ${analysis.repository}…` : `Reading the configuration of ${analysis.repository}…`}</span></div>
          </>
        ) : (
          <>
            <Icon name="warning" size={22} />
            <div><strong>Could not infer the diagram</strong><span>{dfd.message}</span></div>
            <button type="button" className="button button-outline" onClick={retry}>Try again</button>
          </>
        )}
      </div>
    </div>
  );
}
