"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
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

export function CanvasLoader(props: ComponentProps<typeof CanvasViewType>) {
  return <CanvasView {...props} />;
}
