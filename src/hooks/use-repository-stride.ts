"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { mockAnalysis } from "@/lib/api/mock/analysis";
import { isDemoRepository } from "@/lib/api/repositories";
import {
  analyzeDfdStride,
  fetchRepositoryStride,
  strideReportToFindings,
} from "@/lib/api/stride";
import type { StrideReport } from "@/lib/api/stride";
import type { Finding } from "@/lib/api/types";
import type { DfdGraph } from "@/lib/dfd/schema";

export type StrideState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; report: StrideReport | null; findings: Finding[] }
  | { status: "error"; error: string };

const strideCache = new Map<string, { report: StrideReport | null; findings: Finding[] }>();

export function clearStrideCache() {
  strideCache.clear();
}

export interface UseRepositoryStrideOptions {
  repository: string;
  dfdGraph?: DfdGraph | null;
  enabled?: boolean;
}

export function useRepositoryStride({ repository, dfdGraph, enabled = true }: UseRepositoryStrideOptions) {
  const isDemo = isDemoRepository(repository);
  const repoKey = repository.toLowerCase();

  const [state, setState] = useState<StrideState>(() => {
    if (isDemo) {
      return { status: "ready", report: null, findings: mockAnalysis.findings };
    }
    const cached = strideCache.get(repoKey);
    if (cached) {
      return { status: "ready", report: cached.report, findings: cached.findings };
    }
    return { status: "idle" };
  });

  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    if (!enabled) return;

    const cached = strideCache.get(repoKey);
    if (cached && attempt === 0) {
      return;
    }

    let cancelled = false;

    // Trigger async load
    queueMicrotask(() => {
      if (cancelled || !alive.current) return;
      setState({ status: "loading" });

      const run = async () => {
        try {
          let report: StrideReport;
          if (dfdGraph && dfdGraph.nodes.length > 0) {
            report = await analyzeDfdStride(dfdGraph);
          } else {
            report = await fetchRepositoryStride(repository);
          }

          const findings = strideReportToFindings(report);
          strideCache.set(repoKey, { report, findings });

          if (!cancelled && alive.current) {
            setState({ status: "ready", report, findings });
          }
        } catch (err) {
          console.error("STRIDE analysis failed", err);
          if (!cancelled && alive.current) {
            setState({
              status: "error",
              error: errorMessage(err, "Failed to analyze threats using STRIDE."),
            });
          }
        }
      };

      run();
    });

    return () => {
      cancelled = true;
    };
  }, [isDemo, enabled, repoKey, attempt, dfdGraph, repository]);

  const retry = useCallback(() => {
    strideCache.delete(repoKey);
    setAttempt((n) => n + 1);
  }, [repoKey]);

  return {
    ...state,
    retry,
  };
}
