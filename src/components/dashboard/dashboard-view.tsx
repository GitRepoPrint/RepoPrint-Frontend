"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DashboardReportDocument } from "@/components/report/dashboard-report-document";
import { Icon } from "@/components/ui/icon";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { useToast } from "@/components/ui/toast";
import { useRepositoryStride } from "@/hooks/use-repository-stride";
import { repoSlug } from "@/lib/api/repositories";
import { attachFindingsToDfdModel, enrichModelWithFindings } from "@/lib/api/stride";
import { risksByNode } from "@/lib/findings";
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
  const isDemo = analysis.source === "demo";
  const tab: Tab = isTab(rawTab) ? rawTab : isDemo ? "threats" : "team";

  const stride = useRepositoryStride({ repository: analysis.repository });
  const findings = useMemo(() => {
    if (isDemo) return analysis.findings;
    return stride.status === "ready" ? stride.findings : [];
  }, [isDemo, analysis.findings, stride]);

  const effectiveDfd = useMemo(() => {
    if (isDemo) return analysis.dfd;
    if (stride.status === "ready" && stride.report) {
      return attachFindingsToDfdModel(analysis.dfd, stride.report, findings);
    }
    return enrichModelWithFindings(analysis.dfd, findings);
  }, [isDemo, analysis.dfd, stride, findings]);

  const effectiveAnalysis = useMemo<RepositoryAnalysis>(
    () => ({
      ...analysis,
      findings,
      dfd: effectiveDfd,
    }),
    [analysis, findings, effectiveDfd],
  );

  const [branch, setBranch] = useState(analysis.defaultBranch);
  const [scanId, setScanId] = useState(analysis.scans[0]?.id ?? "");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [triaged, setTriaged] = useState<Finding | null>(null);
  const closeTriage = useCallback(() => setTriaged(null), []);
  const risks = useMemo(() => risksByNode(effectiveDfd, findings), [effectiveDfd, findings]);
  const [nodeId, setNodeId] = useState(risks[0]?.node.id ?? "");

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
            {tab === "threats" && !isDemo && (
              stride.status === "loading" ? (
                <LoadingPanel
                  title="Analyzing threats with STRIDE"
                  detail="Evaluating architectural attack surface and security threats…"
                />
              ) : stride.status === "error" ? (
                <div className="dfd-state dfd-state-error m-6" role="alert">
                  <Icon name="warning" size={22} />
                  <div>
                    <strong>Could not run STRIDE analysis</strong>
                    <span>{stride.error}</span>
                  </div>
                  <button type="button" className="button button-outline" onClick={stride.retry}>
                    Try again
                  </button>
                </div>
              ) : (
                <ThreatsTab
                  analysis={effectiveAnalysis}
                  risks={risks}
                  nodeId={nodeId}
                  reasons={reasons}
                  onTriage={setTriaged}
                  onSelectNode={setNodeId}
                  onShowInDiagram={(id) => openNode("dfd", id)}
                />
              )
            )}
            {tab === "threats" && isDemo && (
              <ThreatsTab
                analysis={analysis}
                risks={risks}
                nodeId={nodeId}
                reasons={reasons}
                onTriage={setTriaged}
                onSelectNode={setNodeId}
                onShowInDiagram={(id) => openNode("dfd", id)}
              />
            )}
            {tab === "dfd" && (
              <DfdTab
                repository={analysis.repository}
                demoModel={effectiveDfd}
                findings={findings}
                nodeId={nodeId}
                onSelectNode={setNodeId}
                onOpenThreats={(id) => openNode("threats", id)}
                onEdit={() => router.push(canvasUrl)}
              />
            )}
            {tab === "team" && <TeamTab analysis={effectiveAnalysis} />}
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
