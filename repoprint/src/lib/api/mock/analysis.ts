import type { RepositoryAnalysis } from "../types";
import { findings } from "./findings";

// Mock da análise de um repositório associado. `repository` é preenchido em getRepositoryAnalysis().
export const mockAnalysis: Omit<RepositoryAnalysis, "repository"> = {
  commit: "a3f89c1",
  branches: ["main", "develop", "release/v2"],
  defaultBranch: "main",
  analyzedAt: "2026-10-26T09:30:00Z",
  lastScanned: "2 hours ago",
  executiveSummary:
    "The primary residual risks concern session integrity, webhook validation, and the correlation of personal identifiers in telemetry and transaction logs.",
  scans: [
    { id: "scan-14", label: "Scan #14 — Commit a3f89c1 (main)" },
    { id: "scan-13", label: "Scan #13 — PR #42" },
    { id: "scan-12", label: "Scan #12 — Commit a89c01" },
  ],
  findings,
  dfd: {
    boundary: { x: 272, y: 27, width: 696, height: 274, label: "INTERNAL BACKEND · TRUST BOUNDARY" },
    nodes: [
      { id: "client", title: "Client Browser", subtitle: "EXTERNAL ENTITY", kind: "external", x: 100, y: 132, code: "EN-001", classification: "External entry", findingIds: [] },
      { id: "idp", title: "External Auth", subtitle: "IDENTITY PROVIDER", kind: "external", x: 100, y: 244, code: "EN-002", classification: "External entry", findingIds: [] },
      { id: "gateway", title: "Auth Gateway", subtitle: "PROCESS", kind: "process", x: 348, y: 117, code: "PR-003", classification: "Internal service", findingIds: ["stride-spoofing"] },
      { id: "payments", title: "Payment Engine", subtitle: "PROCESS", kind: "process", x: 555, y: 117, code: "PR-004", classification: "Internal service", findingIds: ["stride-tampering"] },
      { id: "telemetry", title: "Telemetry Collector", subtitle: "PROCESS", kind: "process", x: 800, y: 117, code: "PR-005", classification: "Internal service", findingIds: ["linddun-linkability", "linddun-detectability"] },
      { id: "users-db", title: "Users DB", subtitle: "SENSITIVE DATA", kind: "store", x: 555, y: 240, code: "DS-006", classification: "Sensitive · PII", findingIds: ["stride-information-disclosure"] },
      { id: "event-logs", title: "Event Logs", subtitle: "TELEMETRY DATA", kind: "store", x: 800, y: 240, code: "DS-007", classification: "Internal logs", findingIds: [] },
    ],
    flows: [
      "M166 132 C220 132 235 117 305 117",
      "M166 244 C238 244 237 147 305 140",
      "M390 117 H478",
      "M555 162 V211",
      "M632 117 H716",
      "M800 160 V211",
    ],
    edges: [
      { id: "e-client-gateway", source: "client", target: "gateway", sourceHandle: "r", targetHandle: "l", label: "HTTPS REQUEST" },
      { id: "e-idp-gateway", source: "idp", target: "gateway", sourceHandle: "r", targetHandle: "l", label: "OIDC TOKEN" },
      { id: "e-gateway-payments", source: "gateway", target: "payments", sourceHandle: "r", targetHandle: "l", label: "AUTHORIZED CALL" },
      { id: "e-payments-users-db", source: "payments", target: "users-db", sourceHandle: "b", targetHandle: "t", label: "USER DATA" },
      { id: "e-payments-telemetry", source: "payments", target: "telemetry", sourceHandle: "r", targetHandle: "l", label: "EVENTS" },
      { id: "e-telemetry-event-logs", source: "telemetry", target: "event-logs", sourceHandle: "b", targetHandle: "t", label: "TELEMETRY" },
    ],
    markers: [
      { id: "m-session", label: "auth/session.ts", x: 205, y: 80, level: "critical" },
      { id: "m-tracker", label: "telemetry/tracker.go", x: 643, y: 80, level: "warning" },
    ],
  },
  team: {
    commits30d: 47,
    commitsStatus: "Stable",
    prMergeHours: 4.2,
    prMergeStatus: "Fast turnaround",
    codeOwnersCoverage: 92,
    codeOwnersStatus: "Enforced",
    weeklyCommits: [8, 12, 9, 14, 11, 7, 13, 10, 12, 11, 13, 11],
    recentPrs: [
      { number: 431, hours: 2.1 },
      { number: 434, hours: 5.5 },
      { number: 438, hours: 3.2 },
      { number: 441, hours: 9.8 },
      { number: 445, hours: 1.4 },
      { number: 447, hours: 4 },
      { number: 452, hours: 6.3 },
      { number: 455, hours: 2.7 },
      { number: 459, hours: 3.9 },
      { number: 462, hours: 3.1 },
    ],
    punchCard: Array.from({ length: 7 }, (_, day) =>
      Array.from({ length: 24 }, (_, hour) => {
        const weekday = day >= 1 && day <= 5;
        const peak = Math.max(0, 6 - Math.abs(hour - (hour < 13 ? 11 : 16)) * 2);
        const boost = day === 2 || day === 3 ? 2 : 0;
        if (weekday) return hour >= 8 && hour <= 20 ? peak + boost + ((day * 3 + hour) % 3) : 0;
        return day === 6 && hour >= 10 && hour <= 16 ? (hour + 1) % 3 : 0;
      }),
    ),
    contributors: [
      { initials: "MC", name: "Marta Costa", role: "Maintainer", commits: 142, reviewParticipation: 94, ownership: "Core / Payments", color: "lavender" },
      { initials: "JL", name: "João Lima", role: "Backend", commits: 98, reviewParticipation: 88, ownership: "Auth / API Gateway", color: "peach" },
      { initials: "AS", name: "Ana Silva", role: "Security", commits: 76, reviewParticipation: 97, ownership: "Policies / Telemetry", color: "mint" },
      { initials: "RP", name: "Rui Pereira", role: "Frontend", commits: 54, reviewParticipation: 81, ownership: "Client / Webhooks", color: "blue" },
    ],
  },
  hygiene: {
    languages: [
      { name: "TypeScript", percent: 68 },
      { name: "Go", percent: 22 },
      { name: "SQL", percent: 10 },
    ],
    branches: {
      defaultBranch: "main",
      protected: true,
      rules: ["Require pull request reviews before merging (1 approval)", "Enforce status checks"],
      protectedBranches: ["release/v2"],
      total: 14,
    },
    quality: { coverage: 86, ci: { provider: "GitHub Actions", passing: true, lastRun: "12m ago" } },
    license: { name: "MIT License", osiApproved: true, commercialUseCompliant: true },
  },
};
