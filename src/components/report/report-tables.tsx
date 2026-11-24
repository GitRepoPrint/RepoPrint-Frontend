import { effortText } from "@/components/score/effort";
import { byFramework, gdprArticles, prioritize, SEVERITY_LABEL } from "@/lib/findings";
import type { Finding } from "@/lib/api/types";

// Tabelas do relatório formal (versão para impressão). Partilhadas pela landing e pelo dashboard.
// Sem hooks: podem ser renderizadas no servidor.

export function ExposureTable({ findings }: { findings: Finding[] }) {
  return (
    <table className="formal-table">
      <thead>
        <tr><th>Component</th><th>Risk</th><th>Impact</th><th>Fix effort</th></tr>
      </thead>
      <tbody>
        {findings.map((f) => (
          <tr key={f.id}>
            <td>{f.component}</td>
            <td>{f.title}</td>
            <td>{SEVERITY_LABEL[f.exposure.impact]} · {f.exposure.impactLabel}</td>
            <td>{effortText(f.effort)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StrideTable({ findings }: { findings: Finding[] }) {
  const rows = byFramework(findings, "STRIDE");
  return (
    <table className="formal-table">
      <thead>
        <tr><th>Threat</th><th>Affected file / flow</th><th>Severity</th><th>Impact</th><th>Regulatory controls</th></tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={5}>No findings reported.</td></tr>}
        {rows.map((f) => (
          <tr key={f.id}>
            <td>{f.category}</td>
            <td><code>{f.file}</code> · {f.location}</td>
            <td className={`formal-${f.severity}`}>{SEVERITY_LABEL[f.severity]}</td>
            <td>{f.impactDetail}</td>
            <td>{f.regulatoryTags.join("; ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LinddunTable({ findings }: { findings: Finding[] }) {
  const rows = byFramework(findings, "LINDDUN");
  return (
    <table className="formal-table">
      <thead>
        <tr><th>Privacy Threat (LINDDUN GO)</th><th>Affected component</th><th>Hotspot</th><th>Description</th></tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={4}>No findings reported.</td></tr>}
        {rows.map((f) => (
          <tr key={f.id}>
            <td><strong>{f.category}</strong>{f.ref ? ` [${f.ref}]` : ""}</td>
            <td>{f.component} · <code>{f.file}</code></td>
            <td>{f.topic || "Inbound User"}</td>
            <td>{f.impactDetail || f.title}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PrintMitigations({ findings }: { findings: Finding[] }) {
  return (
    <ol>
      {prioritize(findings).map((f) => (
        <li key={f.id}>
          <strong>{SEVERITY_LABEL[f.severity]} Priority · {f.topic}:</strong> {f.mitigation}
        </li>
      ))}
    </ol>
  );
}
