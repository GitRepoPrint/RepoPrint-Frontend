"use client";

import { useRouter } from "next/navigation";
import { GitReportDocument } from "@/components/report/git-report-document";
import { DATA_TIME_ZONE } from "@/lib/activity-notes";
import { formatClock } from "@/lib/format";
import { fileBaseName } from "@/lib/download";
import { printReport } from "@/lib/print";
import type { GitAnalysis } from "@/lib/api/types";
import { CodeAnalysisPending } from "./code-analysis-pending";
import { DashboardTabList, DashboardTabPanel, useDashboardTab } from "./dashboard-tabs";
import { GitTeamTab } from "./git-team-tab";
import { GitDashboardHeader } from "./git-dashboard-header";

export function GitDashboard({ analysis }: { analysis: GitAnalysis }) {
  const router= useRouter();
  const { tab, selectTab }= useDashboardTab("team");
  const { activity, git }= analysis;
  const clock= formatClock(activity.fetchedAt, DATA_TIME_ZONE);
  const dataTime= activity.cached ? `Git data saved at ${clock}` : `Git data read at ${clock}`;

  const openTeamTab= (
    <button type="button" className="button button-outline" onClick={() => selectTab("team")}>
      Open Team Dynamics &amp; Repository Hygiene
    </button>
  );

  return (
    <>
      <main className="dashboard-main print:hidden!">
        <GitDashboardHeader
          repository={analysis.repository}
          branch={git.defaultBranch}
          dataTime={dataTime}
          onBack={() => router.push("/repositories")}
          onExport={() => printReport(`${fileBaseName(analysis.repository)}-git-report`)}
        />

        <DashboardTabList tab={tab} onSelect={selectTab} />

        <DashboardTabPanel tab={tab}>
          {tab === "threats" && <CodeAnalysisPending subject="threats">{openTeamTab}</CodeAnalysisPending>}
          {tab === "dfd" && <CodeAnalysisPending subject="dfd">{openTeamTab}</CodeAnalysisPending>}
          {tab === "team" && <GitTeamTab analysis={analysis} />}
        </DashboardTabPanel>
      </main>

      <GitReportDocument analysis={analysis} />
    </>
  );
}
