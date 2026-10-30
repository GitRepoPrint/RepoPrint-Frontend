import { FormalDfd } from "@/components/dfd/formal-dfd";
import { formatReportDate } from "@/lib/format";
import type { RepositoryAnalysis } from "@/lib/api/types";
import { ReportFooter, ReportHeader, ReportSection } from "./report-parts";
import { ExposureTable, LinddunTable, PrintMitigations, StrideTable } from "./report-tables";

type Props = { analysis: RepositoryAnalysis; branch: string };

/** Relatório formal completo do dashboard. Escondido no ecrã; aparece só ao imprimir ("Export PDF Report"). */
export function DashboardReportDocument({ analysis, branch }: Props) {
  const { findings, team, hygiene } = analysis;
  const date = formatReportDate(analysis.analyzedAt);
  const { branches, quality } = hygiene;

  return (
    <main className="report-document hidden! print:block!" aria-labelledby="formal-report-title">
      <ReportHeader repository={analysis.repository} branch={branch} commit={analysis.commit} date={date} />

      <ReportSection number="01" title="Executive Summary & Risk Overview">
        <p className="report-lead">{analysis.executiveSummary}</p>
        <ExposureTable findings={findings} />
      </ReportSection>

      <ReportSection number="02" title="Threat Modeling Findings (STRIDE)">
        <StrideTable findings={findings} />
      </ReportSection>

      <ReportSection number="03" title="Privacy Risk Assessment (LINDDUN)">
        <LinddunTable findings={findings} />
      </ReportSection>

      <ReportSection number="04" title="Inferred Architecture & Data Flow Diagram (DFD)" className="formal-dfd-section">
        <p>Primary payment and identity flows inferred from repository structure and analysis findings.</p>
        <FormalDfd />
      </ReportSection>

      <ReportSection number="05" title="Team Cadence & Structural Hygiene">
        <table className="formal-table">
          <tbody>
            <tr>
              <th>Repository activity</th>
              <td>{team.commits30d} commits in the last 30 days · average merge time {team.prMergeHours}h · Code Owners coverage {team.codeOwnersCoverage}%</td>
            </tr>
            <tr>
              <th>Contributors</th>
              <td>{team.contributors.map((c) => `${c.name} (${c.commits} commits)`).join(", ")}</td>
            </tr>
            <tr>
              <th>Branches</th>
              <td>
                <code>{branches.defaultBranch}</code> (default{branches.protected ? ", protected" : ""})
                {branches.protectedBranches.map((name) => <span key={name}> · <code>{name}</code> (protected)</span>)}
                <span> · {branches.total - 1 - branches.protectedBranches.length} other branches not protected</span>
              </td>
            </tr>
            <tr><th>Languages</th><td>{hygiene.languages.map((l) => `${l.name} ${l.percent}%`).join(" · ")}</td></tr>
            <tr>
              <th>Tests / CI</th>
              <td>{quality.coverage}% test coverage · CI checks {quality.ci.passing ? "passing" : "failing"} on the latest analyzed commit</td>
            </tr>
          </tbody>
        </table>
      </ReportSection>

      <ReportSection number="06" title="Recommended Mitigations" className="formal-mitigations">
        <PrintMitigations findings={findings} />
      </ReportSection>

      <ReportFooter date={date} />
    </main>
  );
}
