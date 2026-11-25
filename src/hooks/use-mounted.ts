import { useSyncExternalStore } from "react";

// Não há nada a que subscrever: o valor só muda uma vez, da renderização no servidor para o browser.
const subscribe = () => () => {};

/**
 * true só depois da hidratação; evita hydration mismatch com valores que dependem do browser.
 * No servidor e durante a hidratação o React usa o getServerSnapshot (false); a seguir volta a renderizar com o
 * getSnapshot (true). Ao contrário de um useEffect + setState, não faz setState dentro de um efeito.
 */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
