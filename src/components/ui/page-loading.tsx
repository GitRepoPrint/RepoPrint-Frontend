"use client";

import { useEffect, useState } from "react";
import { LoadingPanel } from "./loading-panel";

type PageLoadingProps = {
  title: string;
  detail?: string;
  /** Passados estes segundos sem acabar, diz-se que está a demorar mais do que o habitual. */
  slowAfter?: number;
  slowNote?: string;
};

/**
 * A espera de uma página inteira (os ficheiros loading.tsx): a página é construída no servidor e, até estar pronta, o navegador
 * não tinha nada para mostrar. Não se sabe quanto falta, por isso é uma roda a girar com o tempo que já passou; passado
 * `slowAfter` segundos explica que um repositório grande demora mais.
 */
export function PageLoading({ title, detail, slowAfter = 8, slowNote = "Still working. GitHub can be slow for large repositories." }: PageLoadingProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="loading-page">
      <LoadingPanel title={title} detail={detail} note={seconds >= slowAfter ? `${slowNote} (${seconds} s)` : undefined} />
    </main>
  );
}
