import { useEffect } from "react";

/** Chama `onEscape` quando se carrega em Escape (usado para fechar os modais). Passar uma função estável (useCallback). */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onEscape(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onEscape]);
}
