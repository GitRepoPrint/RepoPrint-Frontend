import { EffortLabel } from "@/components/score/effort";
import { byFramework, gdprArticles, prioritize, SEVERITY_LABEL } from "@/lib/findings";
import type { Finding, RepositoryAnalysis } from "@/lib/api/types";

type ThreatsTabProps = {
  analysis: RepositoryAnalysis;
  reasons: Record<string, string>;                 // id do finding -> justificação de falso positivo
  onTriage: (finding: Finding) => void;
};

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => (
  <section className="formal-report-section">
    <div className="formal-section-title"><span>{number}</span><h2>{title}</h2></div>
    {children}
  </section>
);

function TriageButton({ finding, reasons, onTriage }: { finding: Finding } & Pick<ThreatsTabProps, "reasons" | "onTriage">) {
  return (
    <button type="button" className="threat-report-action" onClick={() => onTriage(finding)}>
      {reasons[finding.id] ? "Edit justification" : "Mark as False Positive"}
    </button>
  );
}

export function ThreatsTab({ analysis, reasons, onTriage }: ThreatsTabProps) {
  const { findings } = analysis;
  const stride = byFramework(findings, "STRIDE");
  const linddun = byFramework(findings, "LINDDUN");

  return (
    <div className="threat-report-view">
      <Section number="01" title="Executive Summary & Risk Overview">
        <div className="threat-report-summary"><p>{analysis.executiveSummary}</p></div>
        <div className="threat-report-table-wrap">
          <table className="formal-table">
            <thead><tr><th>Component</th><th>Risk</th><th>Impact</th><th>Fix effort</th></tr></thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id}>
                  <td>{f.component}</td>
                  <td>{f.title}</td>
                  <td><span className={`threat-report-severity ${f.exposure.impact}`}>{SEVERITY_LABEL[f.exposure.impact]}</span> {f.exposure.impactLabel}</td>
                  <td><EffortLabel effort={f.effort} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section number="02" title="Threat Modeling Findings (STRIDE)">
        <div className="threat-report-table-wrap">
          <table className="formal-table">
            <thead>
              <tr><th>Threat</th><th>Affected file / flow</th><th className="threat-report-severity-cell">Severity</th><th>Impact</th><th>Regulatory controls</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {stride.map((f) => (
                <tr key={f.id}>
                  <td>{f.category}</td>
                  <td><code>{f.file}</code> <span className="threat-report-context">({f.location})</span></td>
                  <td className="threat-report-severity-cell"><span className={`threat-report-severity ${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span></td>
                  <td>{f.impactDetail}</td>
                  <td><div className="threat-report-tags">{f.regulatoryTags.map((tag) => <span className="threat-report-tag" key={tag}>{tag}</span>)}</div></td>
                  <td><TriageButton finding={f} reasons={reasons} onTriage={onTriage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section number="03" title="Privacy Risk Assessment (LINDDUN)">
        <div className="threat-report-table-wrap">
          <table className="formal-table">
            <thead>
              <tr><th>Privacy risk</th><th>Affected component</th><th className="threat-report-severity-cell">Severity</th><th>Applicable GDPR articles</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {linddun.map((f) => (
                <tr key={f.id}>
                  <td>{f.category}</td>
                  <td>{f.component} / {f.file}</td>
                  <td className="threat-report-severity-cell"><span className={`threat-report-severity ${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span></td>
                  <td><div className="threat-report-tags">{gdprArticles(f).map((article) => <span className="threat-report-tag" key={article}>{article}</span>)}</div></td>
                  <td><TriageButton finding={f} reasons={reasons} onTriage={onTriage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section number="04" title="Recommended Mitigations">
        <ol className="threat-report-mitigations">
          {prioritize(findings).map((f) => (
            <li key={f.id}>
              <div className="threat-report-mitigation-topic">
                <span className={`threat-report-priority ${f.severity}`}>{SEVERITY_LABEL[f.severity]} Priority</span>
                <strong>{f.topic}:</strong>
              </div>
              <p>{f.mitigation}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
