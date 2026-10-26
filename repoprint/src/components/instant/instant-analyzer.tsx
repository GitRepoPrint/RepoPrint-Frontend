"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { InstantReportDocument } from "@/components/report/instant-report-document";
import { useToast } from "@/components/ui/toast";
import { analyzeInstant, DEFAULT_REPOSITORY, parseGithubRepository } from "@/lib/api/instant";
import type { InstantReport as Report } from "@/lib/api/types";
import { InstantForm } from "./instant-form";
import { InstantReport } from "./instant-report";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; report: Report };

// `children` é a parte estática do hero (título e subtítulo), renderizada no servidor.
export function InstantAnalyzer({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const { notify } = useToast();

  async function run(input: string) {
    const trimmed = input.trim();
    const repository = trimmed ? parseGithubRepository(trimmed) : DEFAULT_REPOSITORY;
    if (!repository) {
      notify("Enter a valid public GitHub repository URL.");
      return; // como no mockup: o estado atual mantém-se
    }
    setState({ status: "loading" });
    setState({ status: "done", report: await analyzeInstant(repository) });
  }

  return (
    <>
      <main className="landing-main print:hidden!">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="hero-content">
          {children}
          <InstantForm loading={state.status === "loading"} onSubmit={run} />
        </div>

        {state.status === "loading" && (
          <div className="analysis-loading" role="status">
            <span className="analysis-spinner large" />
            <div>
              <strong>Analyzing repository</strong>
              <span>Mapping threats, privacy risks, Git activity, and architecture...</span>
            </div>
          </div>
        )}

        {state.status === "done" && <InstantReport report={state.report} />}
      </main>

      {/* Escondido no ecrã e mostrado só na impressão (classes Tailwind dentro do próprio componente) */}
      {state.status === "done" && <InstantReportDocument report={state.report} />}
    </>
  );
}
