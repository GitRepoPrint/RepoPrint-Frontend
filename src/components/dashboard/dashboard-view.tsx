"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DashboardReportDocument } from "@/components/report/dashboard-report-document";
import { useToast } from "@/components/ui/toast";
import { toFrontendFindings, useLinddun } from "@/linddun";
import { repoSlug } from "@/lib/api/repositories";
import { risksByNode } from "@/lib/findings";
import { findings as mockFindings } from "@/lib/api/mock/findings";
import { fileBaseName } from "@/lib/download";
import { printReport } from "@/lib/print";
import type { Finding, RepositoryAnalysis } from "@/lib/api/types";
import { DashboardHeader } from "./dashboard-header";
import { DfdTab } from "./dfd-tab";
import { FalsePositiveModal } from "./false-positive-modal";
import { TeamTab } from "./team-tab";
import { ThreatsTab } from "./threats-tab";

type Tab = "threats" | "dfd" | "team";

export const TABS: { id: Tab; label: string }[] = [
  { id: "threats", label: "Threat Modeling & Architectural Posture" },
  { id: "dfd", label: "Inferred Architecture & Data Flow Diagram" },
  { id: "team", label: "Team Dynamics & Repository Hygiene" },
];

const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

export function DashboardView({ analysis }: { analysis: RepositoryAnalysis }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notify } = useToast();

  const rawTab = searchParams.get("tab");
  const tab: Tab = isTab(rawTab) ? rawTab : analysis.source === "git" ? "team" : "threats";

  const [branch, setBranch] = useState(analysis.defaultBranch);
  const [scanId, setScanId] = useState(analysis.scans[0]?.id ?? "");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [triaged, setTriaged] = useState<Finding | null>(null);
  const closeTriage = useCallback(() => setTriaged(null), []);

  const { report, status, error, refetch } = useLinddun(analysis.repository, analysis.dfd);

  const effectiveFindings = useMemo(() => {
    const baselineStride = mockFindings.filter((f) => f.framework === "STRIDE");
    const existingStride = analysis.findings.filter((f) => f.framework === "STRIDE");
    const strideList = existingStride.length > 0 ? existingStride : baselineStride;

    if (!report?.findings?.length) {
      const existingLinddun = analysis.findings.filter((f) => f.framework === "LINDDUN");
      const baselineLinddun = mockFindings.filter((f) => f.framework === "LINDDUN");
      const linddunList = existingLinddun.length > 0 ? existingLinddun : baselineLinddun;
      return [...strideList, ...linddunList];
    }
    const backendLinddunFindings = toFrontendFindings(report);
    return [...strideList, ...backendLinddunFindings];
  }, [analysis.findings, report]);

  const risks = useMemo(() => risksByNode(analysis.dfd, effectiveFindings), [analysis.dfd, effectiveFindings]);

  const effectiveAnalysis = useMemo(
    () => ({
      ...analysis,
      findings: effectiveFindings,
      dfd: {
        ...analysis.dfd,
        nodes: analysis.dfd.nodes.length > 0 ? analysis.dfd.nodes : risks.map((r) => r.node),
      },
    }),
    [analysis, effectiveFindings, risks],
  );

  const [nodeId, setNodeId] = useState("");
  const activeNodeId = risks.some((r) => r.node.id === nodeId) ? nodeId : (risks[0]?.node.id ?? "");

  const base = `/repositories/${repoSlug(analysis.repository)}`;
  const canvasUrl = `${base}/dfd?branch=${encodeURIComponent(branch)}`;

  function selectTab(next: Tab) {
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  }

  function openNode(next: Tab, id: string) {
    setNodeId(id);
    selectTab(next);
  }

  function saveReason(reason: string) {
    if (!triaged) return;
    setReasons((current) => ({ ...current, [triaged.id]: reason }));
    setTriaged(null);
    notify("Finding marked as false positive.");
  }

  return (
    <>
      <main className="dashboard-main print:hidden!">
        <DashboardHeader
          repository={analysis.repository}
          lastScanned={analysis.lastScanned}
          branches={analysis.branches}
          branch={branch}
          onBranchChange={setBranch}
          scans={analysis.scans}
          scanId={scanId}
          onScanChange={setScanId}
          onBack={() => router.push("/repositories")}
          onScan={() => router.push(canvasUrl)}
          onExport={() => printReport(`${fileBaseName(analysis.repository)}-audit-report`)}
        />

        <nav className="dashboard-tabs" role="tablist" aria-label="Dashboard analysis sections">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              id={`${id}-tab`}
              type="button"
              className={`dashboard-tab ${tab === id ? "active" : ""}`}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${id}-panel`}
              onClick={() => selectTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="dashboard-tab-content">
          <div id={`${tab}-panel`} className="dashboard-tab-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
            {tab === "threats" && analysis.source === "git" && status === "loading" && !report && (
              <div className="threat-report-view">
                <section className="formal-report-section" aria-label="Threat Modeling and Architectural Posture">
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <p style={{ fontWeight: 600, marginBottom: "8px" }}>Analyzing privacy and architectural threats…</p>
                    <p style={{ fontSize: "14px", opacity: 0.7 }}>Running LINDDUN privacy analysis on {analysis.repository}…</p>
                  </div>
                </section>
              </div>
            )}
            {tab === "threats" && analysis.source === "git" && status === "error" && !report && (
              <div className="threat-report-view">
                <section className="formal-report-section" aria-label="Threat Modeling and Architectural Posture">
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <p style={{ fontWeight: 600, color: "#be123c", marginBottom: "8px" }}>
                      {error instanceof Error ? error.message : "Failed to load threat analysis"}
                    </p>
                    <button type="button" className="threat-report-action" onClick={refetch}>
                      Retry analysis
                    </button>
                  </div>
                </section>
              </div>
            )}
            {tab === "threats" && (analysis.source === "demo" || (analysis.source === "git" && (report || (status !== "loading" && status !== "error")))) && (
              <ThreatsTab
                analysis={effectiveAnalysis}
                linddunReport={report}
                risks={risks}
                nodeId={activeNodeId}
                reasons={reasons}
                onTriage={setTriaged}
                onSelectNode={setNodeId}
                onShowInDiagram={(id) => openNode("dfd", id)}
              />
            )}
            {tab === "dfd" && (
              <DfdTab
                repository={analysis.repository}
                demoModel={analysis.dfd}
                findings={effectiveFindings}
                nodeId={activeNodeId}
                onSelectNode={setNodeId}
                onOpenThreats={(id) => openNode("threats", id)}
                onEdit={() => router.push(canvasUrl)}
              />
            )}
            {tab === "team" && <TeamTab analysis={analysis} />}
          </div>
        </div>
      </main>

      {triaged && (
        <FalsePositiveModal finding={triaged} initialReason={reasons[triaged.id] ?? ""} onClose={closeTriage} onSave={saveReason} />
      )}

      <DashboardReportDocument analysis={effectiveAnalysis} branch={branch} />
    </>
  );
}
