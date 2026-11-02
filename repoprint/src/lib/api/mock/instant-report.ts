import type { Framework, InstantReport, Severity } from "../types";
import { findings } from "./findings";

// Mock da análise instantânea. `repository` e `analyzedAt` são preenchidos em analyzeInstant().
// Os contadores derivam da lista, para nunca divergirem do que é mostrado.
const count = (framework: Framework, severity?: Severity) =>
  findings.filter((f) => f.framework === framework && (!severity || f.severity === severity)).length;

export const mockInstantReport: Omit<InstantReport, "repository" | "analyzedAt"> = {
  commit: "a3f89c1",
  branch: "main",
  summary: {
    stride: {
      findings: count("STRIDE"),
      high: count("STRIDE", "high"),
      medium: count("STRIDE", "medium"),
      detail: "Spoofing, webhook tampering, information disclosure",
    },
    privacy: {
      highRisks: count("LINDDUN", "high"),
      labels: "Linkability · Detectability",
      detail: "Personal identifiers in telemetry and transaction logs",
    },
    git: { prMergeHours: 4.2, commitsPerMonth: 47, codeOwnersCoverage: 92 },
  },
  findings,
};
