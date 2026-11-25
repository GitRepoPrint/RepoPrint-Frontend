import { formatHours, formatReportDate } from "@/lib/format";
import { hygieneGradeWithoutOwners } from "@/lib/score";
import type { InstantReport } from "@/lib/api/types";
import type { LinddunReport } from "@/linddun";
import { ReportFooter, ReportHeader, ReportSection } from "./report-parts";

const NA = "Not available";

/** Relatório formal da análise instantânea: integra dados de Git e LINDDUN GO. */
export function InstantReportDocument({
  report,
  linddunReport,
}: {
  report: InstantReport;
  linddunReport?: LinddunReport | null;
}) {
  const date = formatReportDate(report.analyzedAt);
  const grade = hygieneGradeWithoutOwners({ prMergeHours: report.prMergeHours, commitsPerMonth: report.commitsPerMonth });
  const threats = linddunReport?.threats || linddunReport?.findings || [];

  return (
    <main className="report-document hidden! print:block!" aria-labelledby="formal-report-title">
      <ReportHeader repository={report.repository} branch={report.branch} commit={NA} date={date} />

      <ReportSection number="01" title="Executive Summary & Risk Overview">
        <p className="report-lead">
          {linddunReport
            ? `Security & privacy assessment for ${report.repository}. ${linddunReport.summary.total_findings} privacy threats identified across ${Object.keys(linddunReport.summary.by_category).length} categories.`
            : NA}
        </p>
        <table className="formal-table">
          <tbody>
            <tr><th>Threat modeling (STRIDE)</th><td>{NA}</td></tr>
            <tr>
              <th>Privacy (LINDDUN / GDPR)</th>
              <td>{linddunReport ? `${linddunReport.summary.total_findings} privacy findings identified (LINDDUN GO)` : NA}</td>
            </tr>
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
        {threats.length > 0 ? (
          <table className="formal-table">
            <thead>
              <tr>
                <th>Threat / Card</th>
                <th>Affected Component</th>
                <th>Hotspot</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {threats.map((f, i) => (
                <tr key={i}>
                  <td><strong>{f.threat_id ? `[${f.threat_id}] ` : ""}{f.title || f.category}</strong></td>
                  <td>{f.component_name || f.component_id || f.target_type || "Component"}</td>
                  <td>{f.hotspot || "System"}</td>
                  <td>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{NA}</p>
        )}
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
