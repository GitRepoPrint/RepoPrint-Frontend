import { formatHours, formatReportDate } from "@/lib/format";
import { hygieneGradeWithoutOwners } from "@/lib/score";
import type { InstantReport } from "@/lib/api/types";
import { ReportFooter, ReportHeader, ReportSection } from "./report-parts";

const NA = "Not available";

/** Relatório formal da análise instantânea: só o Git tem dados, o resto diz Not available. */
export function InstantReportDocument({ report }: { report: InstantReport }) {
  const date = formatReportDate(report.analyzedAt);
  const grade = hygieneGradeWithoutOwners({ prMergeHours: report.prMergeHours, commitsPerMonth: report.commitsPerMonth });

  return (
    <main className="report-document hidden! print:block!" aria-labelledby="formal-report-title">
      <ReportHeader repository={report.repository} branch={report.branch} commit={NA} date={date} />

      <ReportSection number="01" title="Executive Summary & Risk Overview">
        <p className="report-lead">{NA}</p>
        <table className="formal-table">
          <tbody>
            <tr><th>Threat modeling (STRIDE)</th><td>{NA}</td></tr>
            <tr><th>Privacy (LINDDUN / GDPR)</th><td>{NA}</td></tr>
            <tr>
              <th>Git intelligence &amp; hygiene</th>
              <td>Grade {grade.total} · median PR merge time {formatHours(report.prMergeHours)} · {report.commitsPerMonth} commits / month</td>
            </tr>
          </tbody>
        </table>
      </ReportSection>

      <ReportSection number="02" title="Threat Modeling Findings (STRIDE)">
        <p>{NA}</p>
      </ReportSection>

      <ReportSection number="03" title="Privacy Risk Assessment (LINDDUN)">
        <p>{NA}</p>
      </ReportSection>

      <ReportSection number="04" title="Inferred Architecture & Data Flow Diagram (DFD)" className="formal-dfd-section">
        <p>{NA}</p>
      </ReportSection>

      <ReportSection number="05" title="Recommended Mitigations" className="formal-mitigations">
        <p>{NA}</p>
      </ReportSection>

      <ReportFooter date={date} />
    </main>
  );
}
