import { activityNotes } from "@/lib/activity-notes";
import { formatHours, formatReportDate } from "@/lib/format";
import type { InstantReport } from "@/lib/api/types";
import { ReportFooter, ReportHeader, ReportSection } from "./report-parts";

/** Relatório formal da análise instantânea: só os números do Git. */
export function InstantReportDocument({ report }: { report: InstantReport }) {
  const date = formatReportDate(report.analyzedAt);
  const { activity } = report;

  return (
    <main className="report-document hidden! print:block!" aria-labelledby="formal-report-title">
      <ReportHeader repository={report.repository} branch={report.branch} date={date} />

      <ReportSection number="01" title="Git Activity">
        <table className="formal-table">
          <tbody>
            <tr><th>Commits / month</th><td>{report.commitsPerMonth}</td></tr>
            <tr><th>Median PR merge time</th><td>{formatHours(report.prMergeHours)}</td></tr>
            <tr><th>Active contributors</th><td>{activity.contributorsWindow.complete ? activity.activeContributors : `At least ${activity.activeContributors}`}</td></tr>
          </tbody>
        </table>
      </ReportSection>

      <ReportSection number="02" title="Git Data Methodology">
        <table className="formal-table">
          <tbody>
            {activityNotes(activity, report.commitsPerMonth, report.prMergeHours).map((row) => (
              <tr key={row.metric}>
                <th>{row.metric}</th>
                <td>{row.value} · {row.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      <ReportFooter date={date} />
    </main>
  );
}
