import { mockAnalysis } from "./mock/analysis";
import { mockInstantReport } from "./mock/instant-report";
import type { Finding, InstantReport } from "./types";
import { analyzeLinddun, toFrontendFindings } from "../linddun";

/** Repositório usado quando o campo está vazio (modo demo, como no mockup). */
export const DEFAULT_REPOSITORY = "deti-org/payment-service";

/**
 * Análise instantânea serverless (sem estado, sem servidor externo dedicado).
 * Executa o motor LINDDUN diretamente no cliente/ambiente serverless sobre o DFD do repositório.
 */
export async function analyzeInstant(repository: string): Promise<InstantReport> {
  // Simular latência de análise instantânea
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Executar a análise LINDDUN serverless sobre o modelo de DFD do repositório
  const dfd = mockAnalysis.dfd;
  const linddunReport = analyzeLinddun(dfd);
  const linddunFindings = toFrontendFindings(linddunReport);

  // Manter os findings do STRIDE e incorporar os findings LINDDUN gerados pelo motor serverless
  const strideFindings = mockInstantReport.findings.filter((f) => f.framework === "STRIDE");
  const combinedFindings: Finding[] = [...strideFindings, ...linddunFindings];

  const linddunHigh = linddunFindings.filter((f) => f.severity === "high").length;
  const uniqueCategories = Array.from(new Set(linddunFindings.map((f) => f.category))).slice(0, 3);

  return {
    repository,
    commit: mockInstantReport.commit,
    branch: mockInstantReport.branch,
    analyzedAt: new Date().toISOString(),
    summary: {
      stride: mockInstantReport.summary.stride,
      privacy: {
        highRisks: linddunHigh,
        labels: uniqueCategories.join(" · "),
        detail: `${linddunReport.summary.total_findings} privacy threats identified across elements and data flows.`,
      },
      git: mockInstantReport.summary.git,
    },
    findings: combinedFindings,
  };
}
