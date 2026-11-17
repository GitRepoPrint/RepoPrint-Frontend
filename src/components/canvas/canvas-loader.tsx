"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, type ComponentProps } from "react";
import { Icon } from "@/components/ui/icon";
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

/** Para um repositório real, o diagrama é o que se infere da configuração dele (o mesmo do dashboard). */
function LiveCanvas({ analysis, branch }: CanvasLoaderProps) {
  const { dfd, retry, detail, loadDetail, detailAvailable } = useRepositoryDfd(analysis.repository);

  // Com o serviço de análise de código configurado, a vista completa é a de detalhe: o overview com tudo aberto.
  // Sem ele (ou se falhar) fica o overview, que é o que a configuração mostra.
  useEffect(() => {
    if (dfd.status === "ready" && detailAvailable && detail.status === "idle") loadDetail();
  }, [dfd.status, detailAvailable, detail.status, loadDetail]);

  const model = useMemo(() => {
    if (dfd.status !== "ready") return null;
    if (detail.status !== "ready") return dfd.model;
    return graphToDfdModel(project(combineGraphs(dfd.graph, detail.graph), { expanded: "all" }));
  }, [dfd, detail]);

  const waitingForCode = dfd.status === "ready" && detailAvailable && (detail.status === "idle" || detail.status === "loading");
  if (dfd.status === "ready" && model && !waitingForCode) return <CanvasView analysis={{ ...analysis, dfd: model }} branch={branch} live />;

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
