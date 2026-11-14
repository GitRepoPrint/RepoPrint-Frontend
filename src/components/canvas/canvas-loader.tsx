"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Icon } from "@/components/ui/icon";
import { useRepositoryDfd } from "@/hooks/use-repository-dfd";
import { isDemoRepository } from "@/lib/api/repositories";
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
  const { dfd, retry } = useRepositoryDfd(analysis.repository);

  if (dfd.status === "ready") return <CanvasView analysis={{ ...analysis, dfd: dfd.model }} branch={branch} live />;

  return (
    <div className="canvas-app h-[calc(100vh-72px)]!" aria-busy={dfd.status === "loading"}>
      <div className="dfd-state m-6" role={dfd.status === "error" ? "alert" : "status"}>
        {dfd.status === "loading" ? (
          <>
            <span className="analysis-spinner large" />
            <div><strong>Inferring the architecture</strong><span>Reading the configuration of {analysis.repository}…</span></div>
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
