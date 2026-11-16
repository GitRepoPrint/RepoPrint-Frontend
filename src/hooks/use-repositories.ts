import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { forgetLegacyRepositories, listRepositories } from "@/lib/api/repositories";
import type { SavedRepository } from "@/lib/api/types";

export type RepositoriesState=
  | { status: "loading" }
  | { status: "ready"; repositories: SavedRepository[] }
  | { status: "failed"; message: string };

const LOADING: RepositoriesState= { status: "loading" };

export function useRepositories() {
  const [state, setState]= useState<RepositoriesState>(LOADING);
  const [attempt, setAttempt]= useState(0);

  useEffect(() => {
    let active= true;
    forgetLegacyRepositories();
    listRepositories().then(
      (repositories) => { if (active) setState({ status: "ready", repositories }); },
      (error) => { if (active) setState({ status: "failed", message: errorMessage(error, "Could not load your repositories. Please try again.") }); },
    );
    return () => { active= false; };
  }, [attempt]);

  const retry= useCallback(() => {
    setState(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  const add= useCallback((repository: SavedRepository) => {
    setState((current) => (current.status === "ready" ? { status: "ready", repositories: [repository, ...current.repositories] } : current));
  }, []);

  return { state, add, retry };
}
