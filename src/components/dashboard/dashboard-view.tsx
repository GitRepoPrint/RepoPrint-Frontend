"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DashboardReportDocument } from "@/components/report/dashboard-report-document";
import { useToast } from "@/components/ui/toast";
import { repoSlug } from "@/lib/api/repositories";
import { risksByNode } from "@/lib/findings";
import { fileBaseName } from "@/lib/download";
import { printReport } from "@/lib/print";
import type { DemoAnalysis, Finding, RepositoryAnalysis } from "@/lib/api/types";
import { DashboardHeader } from "./dashboard-header";
import { DashboardTabList, DashboardTabPanel, useDashboardTab } from "./dashboard-tabs";
import type { Tab } from "./dashboard-tabs";
import { DfdTab } from "./dfd-tab";
import { FalsePositiveModal } from "./false-positive-modal";
import { GitDashboard } from "./git-dashboard";
import { TeamTab } from "./team-tab";
import { ThreatsTab } from "./threats-tab";

export function DashboardView({ analysis }: { analysis: RepositoryAnalysis }) {
  return analysis.mode === "demo" ? <DemoDashboard analysis={analysis} /> : <GitDashboard analysis={analysis} />;
}

function DemoDashboard({ analysis }: { analysis: DemoAnalysis }) {
  const router = useRouter();
  const { notify } = useToast();
  const { tab, selectTab } = useDashboardTab();

  const [branch, setBranch] = useState(analysis.defaultBranch);
  const [scanId, setScanId] = useState(analysis.scans[0]?.id ?? "");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [triaged, setTriaged] = useState<Finding | null>(null);
  const closeTriage = useCallback(() => setTriaged(null), []);
  const risks = useMemo(() => risksByNode(analysis.dfd, analysis.findings), [analysis]);
  const [nodeId, setNodeId] = useState(risks[0]?.node.id ?? "");

  const base = `/repositories/${repoSlug(analysis.repository)}`;
  const canvasUrl = `${base}/dfd?branch=${encodeURIComponent(branch)}`;

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

        <DashboardTabList tab={tab} onSelect={selectTab} />

        <DashboardTabPanel tab={tab}>
          {tab === "threats" && (
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
              model={analysis.dfd}
              risks={risks}
              nodeId={nodeId}
              onSelectNode={setNodeId}
              onOpenThreats={(id) => openNode("threats", id)}
              onEdit={() => router.push(canvasUrl)}
            />
          )}
          {tab === "team" && <TeamTab analysis={analysis} />}
        </DashboardTabPanel>
      </main>

      {triaged && (
        <FalsePositiveModal finding={triaged} initialReason={reasons[triaged.id] ?? ""} onClose={closeTriage} onSave={saveReason} />
      )}

      <DashboardReportDocument analysis={analysis} branch={branch} />
    </>
  );
}
