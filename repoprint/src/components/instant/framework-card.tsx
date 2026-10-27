import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { countByCategory, SEVERITY_LABEL } from "@/lib/findings";
import type { Finding, Severity } from "@/lib/api/types";

type FrameworkCardProps = {
  label: string;
  icon: IconName;
  iconTone: "red" | "orange";
  tone: "stride" | "linddun";
  detail: string;
  categories: readonly string[];
  findings: Finding[];
};

const SEVERITIES: Severity[] = ["high", "medium", "low"];

// Cartão por framework: nº de findings + tags de severidade sempre visíveis;
// o gráfico por categoria só aparece ao abrir o dropdown.
export function FrameworkCard({ label, icon, iconTone, tone, detail, categories, findings }: FrameworkCardProps) {
  const rows = countByCategory(findings, categories);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const bySeverity = SEVERITIES
    .map((severity) => ({ severity, count: findings.filter((f) => f.severity === severity).length }))
    .filter(({ count }) => count > 0);

  return (
    <section className="report-panel framework-card">
      <div className="report-kpi-label">
        <span className={`report-kpi-icon ${iconTone}`}><Icon name={icon} size={17} /></span> {label}
      </div>
      <div className="report-kpi-value">{findings.length} <small>Findings</small></div>
      <div className="report-kpi-foot">
        {bySeverity.map(({ severity, count }, index) => (
          <span key={severity} className="framework-card-tag">
            {index > 0 && <span className="framework-card-sep">·</span>}
            <span className={`severity-${severity}`}>{count} {SEVERITY_LABEL[severity]}</span>
          </span>
        ))}
      </div>

      <details className="framework-card-more">
        <summary aria-label={`${label}: show breakdown by category`}>
          <span className="report-kpi-detail">{detail}</span>
          <Icon name="chevron" size={15} />
        </summary>
        <ul className="category-chart-list">
          {rows.map(({ category, count }) => (
            <li key={category} className={count === 0 ? "is-empty" : undefined}>
              <span className="category-chart-label">{category}</span>
              <span className="category-chart-track" aria-hidden="true">
                <span className={`category-chart-bar ${tone}`} style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span className="category-chart-count">{count}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
