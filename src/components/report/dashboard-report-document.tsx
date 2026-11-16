import { StaticDfd } from "@/components/dfd/static-dfd";
import { formatReportDate } from "@/lib/format";
import type { RepositoryAnalysis } from "@/lib/api/types";
import { ReportFooter, ReportHeader, ReportSection } from "./report-parts";
import { ExposureTable, LinddunTable, PrintMitigations, StrideTable } from "./report-tables";

type Props = { analysis: RepositoryAnalysis; branch: string };

const NA= "Not available";

/** Relatório formal completo do dashboard. Escondido no ecrã; aparece só ao imprimir ("Export PDF Report"). */
export function DashboardReportDocument({ analysis, branch }: Props) {
  const { findings, team, hygiene } = analysis;
  const date = formatReportDate(analysis.analyzedAt);
  const { branches, quality } = hygiene;
  const real = analysis.source === "git";
  const owners = team.codeOwnersCoverage === null ? NA : `${team.codeOwnersCoverage}%`;
  const merge = team.prMergeHours === null ? "N/A" : `${team.prMergeHours}h`;
  const otherBranches = branches.total === null ? NA : `${branches.total - 1 - branches.protectedBranches.length} other branches not protected`;

  return (
    <main className="report-document hidden! print:block!" aria-labelledby="formal-report-title">
      <ReportHeader repository={analysis.repository} branch={branch} commit={analysis.commit ?? NA} date={date} />

      <ReportSection number="01" title="Executive Summary & Risk Overview">
        {real ? <p className="report-lead">{NA}</p> : (
          <>
            <p className="report-lead">{analysis.executiveSummary}</p>
            <ExposureTable findings={findings} />
          </>
        )}
      </ReportSection>

      <ReportSection number="02" title="Threat Modeling Findings (STRIDE)">
        {real ? <p>{NA}</p> : <StrideTable findings={findings} />}
      </ReportSection>

      <ReportSection number="03" title="Privacy Risk Assessment (LINDDUN)">
        {real ? <p>{NA}</p> : <LinddunTable findings={findings} />}
      </ReportSection>

      <ReportSection number="04" title="Inferred Architecture & Data Flow Diagram (DFD)" className="formal-dfd-section">
        {real ? <p>{NA}</p> : (
          <>
            <p>Primary payment and identity flows inferred from repository structure and analysis findings.</p>
            <StaticDfd variant="formal" />
          </>
        )}
      </ReportSection>

      <ReportSection number="05" title="Team Cadence & Structural Hygiene">
        <table className="formal-table">
          <tbody>
            <tr>
              <th>Repository activity</th>
              <td>{team.commits30d} commits in the last 30 days · median merge time {merge} · Code Owners coverage {owners}</td>
            </tr>
            <tr>
              <th>Contributors</th>
              <td>{team.contributors ? team.contributors.map((c, index) => `${real ? `Contributor ${index + 1}` : c.name} (${c.commits} commits)`).join(", ") + (real ? ". Names are withheld in exported reports." : "") : NA}</td>
            </tr>
            <tr>
              <th>Branches</th>
              <td>
                <code>{branches.defaultBranch}</code> (default{branches.protected ? ", protected" : ""})
                {branches.protectedBranches.map((name) => <span key={name}> · <code>{name}</code> (protected)</span>)}
                <span> · {otherBranches}</span>
              </td>
            </tr>
            <tr><th>Languages</th><td>{hygiene.languages ? hygiene.languages.map((l) => `${l.name} ${l.percent}%`).join(" · ") : NA}</td></tr>
            <tr>
              <th>Tests / CI</th>
              <td>
                {quality.coverage === null ? `Test coverage ${NA.toLowerCase()}` : `${quality.coverage}% test coverage`} ·{" "}
                {quality.ci?.passing == null ? `CI status ${NA.toLowerCase()}` : `CI checks ${quality.ci.passing ? "passing" : "failing"} on the latest ${real ? "completed run" : "analyzed commit"}`}
              </td>
            </tr>
          </tbody>
        </table>
      </ReportSection>

      <ReportSection number="06" title="Recommended Mitigations" className="formal-mitigations">
        {real ? <p>{NA}</p> : <PrintMitigations findings={findings} />}
      </ReportSection>

      <ReportFooter date={date} />
    </main>
  );
}
