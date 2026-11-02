import { StaticDfd } from "@/components/dfd/static-dfd";
import { formatReportDate } from "@/lib/format";
import { hygieneGrade } from "@/lib/score";
import type { InstantReport } from "@/lib/api/types";
import { ReportFooter, ReportHeader, ReportSection } from "./report-parts";
import { LinddunTable, PrintMitigations, StrideTable } from "./report-tables";

/** Relatório formal da análise instantânea: só mostra o que a análise instantânea já apresenta. */
export function InstantReportDocument({ report }: { report: InstantReport }) {
  const { summary, findings } = report;
  const date = formatReportDate(report.analyzedAt);
  const highCount = findings.filter((f) => f.severity === "high").length;
  const grade = hygieneGrade(summary.git);

  return (
    <main className="report-document hidden! print:block!" aria-labelledby="formal-report-title">
      <ReportHeader repository={report.repository} branch={report.branch} commit={report.commit} date={date} />

      <ReportSection number="01" title="Executive Summary & Risk Overview">
        <p className="report-lead">
          {findings.length} findings identified across STRIDE threat modeling and LINDDUN privacy analysis, {highCount} of them rated High.
        </p>
        <table className="formal-table">
          <tbody>
            <tr>
              <th>Threat modeling (STRIDE)</th>
              <td>{summary.stride.findings} findings ({summary.stride.high} High, {summary.stride.medium} Medium) · {summary.stride.detail}</td>
            </tr>
            <tr>
              <th>Privacy (LINDDUN / GDPR)</th>
              <td>{summary.privacy.highRisks} high risks ({summary.privacy.labels}) · {summary.privacy.detail}</td>
            </tr>
            <tr>
              <th>Git intelligence &amp; hygiene</th>
              <td>Grade {grade.total}/100 · average PR merge time {summary.git.prMergeHours}h · {summary.git.commitsPerMonth} commits / month · {summary.git.codeOwnersCoverage}% Code Owners coverage</td>
            </tr>
          </tbody>
        </table>
      </ReportSection>

      <ReportSection number="02" title="Threat Modeling Findings (STRIDE)">
        <StrideTable findings={findings} />
      </ReportSection>

      <ReportSection number="03" title="Privacy Risk Assessment (LINDDUN)">
        <LinddunTable findings={findings} />
      </ReportSection>

      <ReportSection number="04" title="Inferred Architecture & Data Flow Diagram (DFD)" className="formal-dfd-section">
        <p>Primary payment and identity flows inferred from repository structure and analysis findings.</p>
        <StaticDfd variant="formal" />
      </ReportSection>

      <ReportSection number="05" title="Recommended Mitigations" className="formal-mitigations">
        <PrintMitigations findings={findings} />
      </ReportSection>

      <ReportFooter date={date} />
    </main>
  );
}
