import { Icon } from "@/components/ui/icon";
import { formatHours } from "@/lib/format";
import { hygieneGrade } from "@/lib/score";
import type { GitMetrics } from "@/lib/score";

function HygieneGradeTable({ git }: { git: GitMetrics }) {
  const grade = hygieneGrade(git);
  return (
    <table className="score-table">
      <thead>
        <tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Score</th></tr>
      </thead>
      <tbody>
        <tr><th scope="row">Median PR merge time</th><td>{formatHours(git.prMergeHours)}</td><td>{grade.merge}</td></tr>
        <tr><th scope="row">Commits / month</th><td>{git.commitsPerMonth}</td><td>{grade.activity}</td></tr>
        <tr><th scope="row">Code Owners coverage</th><td>{git.codeOwnersCoverage}%</td><td>{grade.owners}</td></tr>
      </tbody>
    </table>
  );
}

export function HygieneGradeCard({ git }: { git: GitMetrics }) {
  const grade = hygieneGrade(git);
  return (
    <article className="report-kpi framework-card hygiene-grade-card">
      <div className="report-kpi-label"><span className="report-kpi-icon blue"><Icon name="branch" size={18} /></span> GIT INTELLIGENCE &amp; HYGIENE</div>
      <div className="report-kpi-value">{grade.total} <small>/ 100</small></div>
      <div className="report-kpi-foot">Median PR merge <strong>{formatHours(git.prMergeHours)}</strong></div>
      <div className="report-kpi-foot"><strong>{git.commitsPerMonth}</strong> commits / month</div>
      <details className="framework-card-more">
        <summary aria-label={`Grade ${grade.total} out of 100: show details`}>
          <span className="report-kpi-detail">{git.codeOwnersCoverage}% Code Owners coverage</span>
          <span className="disclosure-pill"><span className="disclosure-icon"><Icon name="chevron" size={16} /></span></span>
        </summary>
        <HygieneGradeTable git={git} />
      </details>
    </article>
  );
}
