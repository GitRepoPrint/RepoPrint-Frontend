"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DashboardReportDocument } from "@/components/report/dashboard-report-document";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { isDemoRepository, repoSlug } from "@/lib/api/repositories";
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

const TABS: { id: Tab; label: string }[] = [
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

  // Num repositório real só o diagrama é verdadeiro (as ameaças e as métricas ainda são exemplos): é por aí que se começa.
  const demo = isDemoRepository(analysis.repository);
  const rawTab = searchParams.get("tab");
  const tab: Tab = isTab(rawTab) ? rawTab : demo ? "threats" : "dfd";

  const [branch, setBranch] = useState(analysis.defaultBranch);
  const [scanId, setScanId] = useState(analysis.scans[0]?.id ?? "");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [triaged, setTriaged] = useState<Finding | null>(null);
  const closeTriage = useCallback(() => setTriaged(null), []);
  const risks = useMemo(() => risksByNode(analysis.dfd, analysis.findings), [analysis]);
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
            {!demo && tab !== "dfd" && (
              <p className="dfd-notice" role="note">
                <Icon name="info" size={16} />
                <span>Threat modeling and team metrics are not computed for this repository yet. What this tab shows is sample data; only the architecture diagram is real.</span>
              </p>
            )}
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
                repository={analysis.repository}
                demoModel={analysis.dfd}
                findings={analysis.findings}
                nodeId={nodeId}
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

      <DashboardReportDocument analysis={analysis} branch={branch} />
    </>
  );
}
