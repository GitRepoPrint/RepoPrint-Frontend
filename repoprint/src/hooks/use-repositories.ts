import { useCallback, useEffect, useState } from "react";
import { loadRepositories, saveRepositories } from "@/lib/api/repositories";
import type { Repository } from "@/lib/api/types";

/**
 * Lista de repositórios do utilizador (mock, guardada no localStorage).
 * `repositories` é null até ser lida no cliente, para não haver diferenças entre servidor e cliente.
 */
export function useRepositories() {
  const [repositories, setRepositories] = useState<Repository[] | null>(null);

  useEffect(() => { setRepositories(loadRepositories()); }, []);

  // Só grava depois de ler: caso contrário a lista de demonstração apagava o que estava guardado.
  useEffect(() => { if (repositories) saveRepositories(repositories); }, [repositories]);

  const add = useCallback((repository: Repository) => {
    setRepositories((current) => (current ? [repository, ...current] : current));
  }, []);

  return { repositories, add };
}
