import { DATA_TIME_ZONE, contributorsValue, mergeSampleText, plural } from "@/lib/activity-notes";
import { formatClock, formatHours, formatReportDate } from "@/lib/format";
import type { GitAnalysis } from "@/lib/api/types";
import { ReportFooter, ReportHeader, ReportSection } from "./report-parts";

export function GitReportDocument({ analysis }: { analysis: GitAnalysis }) {
  const { git, activity }= analysis;
  const date= formatReportDate(analysis.analyzedAt);
  const readWindow= activity.contributorsWindow;
  const bots= activity.botsExcluded > 0 ? `${plural(activity.botsExcluded, "bot")} excluded` : "bots not counted";
  const contributorsWindow= readWindow.complete ? "last 90 days" : `since ${formatReportDate(readWindow.since)}`;

  return (
    <main className="report-document hidden! print:block!" aria-labelledby="formal-report-title">
      <ReportHeader repository={analysis.repository} branch={git.defaultBranch} commit={null} date={date} />

      <ReportSection number="01" title="Repository Activity">
        <table className="formal-table">
          <tbody>
            <tr>
              <th>Commits</th>
              <td>{git.totalCommits} in total · {git.commitsLast30d} in the last 30 days · {git.commitsLast90d} in the last 90 days · {git.commitsPerWeek90d} per week on average (90 days)</td>
            </tr>
            <tr>
              <th>Contributors</th>
              <td>{contributorsValue(activity)} active ({contributorsWindow}, {bots})</td>
            </tr>
            <tr>
              <th>Pull requests</th>
              <td>Median merge time {formatHours(git.medianPrMergeHours)} ({mergeSampleText(activity.mergeSampleSize)}) · {git.openPrs} open</td>
            </tr>
            <tr><th>Issues and stars</th><td>{git.openIssues} open issues (pull requests not counted) · {git.stars} stars</td></tr>
            <tr>
              <th>Data</th>
              <td>{activity.cached ? "Saved" : "Read"} from the GitHub API at {formatClock(activity.fetchedAt, DATA_TIME_ZONE)}, default branch <code>{git.defaultBranch}</code></td>
            </tr>
          </tbody>
        </table>
      </ReportSection>

      <ReportSection number="02" title="Code Analysis">
        <p>Threat modeling (STRIDE), privacy risk (LINDDUN) and the inferred data flow diagram are not available yet for this repository. This report does not estimate them.</p>
      </ReportSection>

      <ReportSection number="03" title="Repository Hygiene">
        <p>Branch protection, tests and CI, license, Code Owners coverage and the Git hygiene grade are not available yet for this repository.</p>
      </ReportSection>

      <ReportFooter date={date} />
    </main>
  );
}
