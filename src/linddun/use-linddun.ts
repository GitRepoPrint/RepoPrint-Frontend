"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLinddunAnalysis,
  fetchLinddunCatalog,
  peekLinddun,
  setLinddunCache,
  LinddunApiError,
} from "./client";
import { analyzeLinddun } from "./engine";
import type { DfdModel } from "@/lib/api/types";
import type {
  LinddunCatalog,
  LinddunReport,
} from "./types";

export interface UseLinddunResult {
  status: "idle" | "loading" | "ready" | "error";
  report: LinddunReport | null;
  catalog: LinddunCatalog | null;
  error: LinddunApiError | Error | null;
  errorMessage: string | null;
  groupBy: "directory" | "file";
  setGroupBy: (mode: "directory" | "file") => void;
  isFallback: boolean;
  refetch: () => void;
}

export function useLinddun(
  repository: string,
  dfdModel?: DfdModel,
  options?: { initialGroupBy?: "directory" | "file" }
): UseLinddunResult {
  const [groupBy, setGroupByState] = useState<"directory" | "file">(
    options?.initialGroupBy ?? "directory"
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [report, setReport] = useState<LinddunReport | null>(() =>
    peekLinddun(repository, groupBy)
  );
  const [catalog, setCatalog] = useState<LinddunCatalog | null>(null);
  const [error, setError] = useState<LinddunApiError | Error | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Fetch catalog once
  useEffect(() => {
    let active = true;
    fetchLinddunCatalog()
      .then((cat) => {
        if (active) setCatalog(cat);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      if (!repository || !repository.trim()) {
        setStatus("idle");
        setReport(null);
        return;
      }

      setStatus("loading");
      setError(null);
      setErrorMessage(null);

      // Check cache first (unless this is an explicit retry attempt)
      if (attempt === 0) {
        const cached = peekLinddun(repository, groupBy);
        if (cached) {
          if (!cancelled) {
            setReport(cached);
            setStatus("ready");
            setIsFallback(false);
          }
          return;
        }
      }

      try {
        const data = await fetchLinddunAnalysis(repository, {
          groupBy,
          signal: controller.signal,
          forceFresh: attempt > 0,
        });

        if (!cancelled) {
          setReport(data);
          setStatus("ready");
          setIsFallback(false);
          setError(null);
          setErrorMessage(null);
        }
      } catch (err: unknown) {
        if (cancelled) return;

        // If backend returned a deliberate HTTP status (400, 429, 503, 404, 500),
        // we MUST preserve and show the actual error as requested!
        if (err instanceof LinddunApiError && err.status !== 0) {
          setError(err);
          setErrorMessage(err.message);
          setStatus("error");
          setIsFallback(false);
          return;
        }

        // Only when the backend is completely unreachable (status 0 / network error)
        // AND we have a client DFD model available (e.g. demo mode or precomputed model),
        // we can gracefully offer the local LINDDUN engine as fallback.
        if (dfdModel && (dfdModel.nodes.length > 0 || dfdModel.edges.length > 0)) {
          try {
            const fallbackReport = analyzeLinddun(dfdModel);
            const formattedReport: LinddunReport = {
              ...fallbackReport,
              repository,
            };

            setReport(formattedReport);
            setStatus("ready");
            setIsFallback(true);
            setLinddunCache(repository, formattedReport, groupBy);
            return;
          } catch (fallbackErr) {
            console.error("Local LINDDUN fallback failed:", fallbackErr);
          }
        }

        const typedErr =
          err instanceof Error
            ? err
            : new LinddunApiError("Erro ao carregar análise LINDDUN", 0, "SERVER_ERROR");
        setError(typedErr);
        setErrorMessage(typedErr.message);
        setStatus("error");
        setIsFallback(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [repository, dfdModel, groupBy, attempt]);

  const setGroupBy = useCallback((mode: "directory" | "file") => {
    setGroupByState(mode);
    setAttempt((n) => n + 1);
  }, []);

  const refetch = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  return {
    status,
    report,
    catalog,
    error,
    errorMessage,
    groupBy,
    setGroupBy,
    isFallback,
    refetch,
  };
}
