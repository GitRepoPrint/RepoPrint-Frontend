import { Icon } from "@/components/ui/icon";
import { SEVERITY_LABEL } from "@/lib/findings";
import { hygieneGrade, SCORE_BANDS, SEVERITIES, SEVERITY_PENALTY } from "@/lib/score";
import type { GitMetrics, SecurityScore } from "@/lib/score";

export function ScoreScale({ score }: { score: SecurityScore }) {
  const bands = [...SCORE_BANDS].reverse().map((band, index, all) => {
    const next = all[index + 1]?.min ?? 100;
    return { ...band, width: next - band.min };
  });
  return (
    <div className="score-scale" role="img" aria-label={`Score ${score.total} out of 100, ${score.band.label}`}>
      <div className="score-scale-bar">
        {bands.map((band) => <span key={band.id} className={`score-band ${band.id}`} style={{ width: `${band.width}%` }} />)}
        <i className="score-marker" style={{ left: `${score.total}%` }} />
      </div>
      <div className="score-scale-ticks" aria-hidden="true">
        {[0, 50, 75, 100].map((tick) => <span key={tick} style={{ left: `${tick}%` }}>{tick}</span>)}
      </div>
    </div>
  );
}

function ScoreTable({ score }: { score: SecurityScore }) {
  const deducted = 100 - score.total;
  return (
    <table className="score-table">
      <thead>
        <tr><th scope="col">Severity</th><th scope="col">Findings</th><th scope="col">Each</th><th scope="col">Points</th></tr>
      </thead>
      <tbody>
        {SEVERITIES.map((severity) => (
          <tr key={severity}>
            <th scope="row"><span className={`severity-${severity}`}>{SEVERITY_LABEL[severity]}</span></th>
            <td>{score.counts[severity]}</td>
            <td>−{SEVERITY_PENALTY[severity]}</td>
            <td>{score.points[severity] ? `−${score.points[severity]}` : 0}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><th scope="row" colSpan={3}>Score (100 − {deducted})</th><td>{score.total}</td></tr>
      </tfoot>
    </table>
  );
}

export function ScoreBreakdown({ score }: { score: SecurityScore }) {
  return (
    <details className="score-explainer">
      <summary>
        <span>How is this calculated?</span>
        <span className="disclosure-icon"><Icon name="chevron" size={16} /></span>
      </summary>
      <div className="score-explainer-body">
        <p>Starts at 100. Each finding subtracts points by severity.</p>
        <ScoreTable score={score} />
        <ul className="score-bands-list" aria-label="Score bands">
          {SCORE_BANDS.map((band, index) => {
            const max = index === 0 ? 100 : SCORE_BANDS[index - 1].min - 1;
            return <li key={band.id}><i className={`score-band ${band.id}`} />{band.min}–{max} {band.label}</li>;
          })}
        </ul>
      </div>
    </details>
  );
}

export function HygieneGrade({ git }: { git: GitMetrics }) {
  const grade = hygieneGrade(git);
  return (
    <>
      <div className="report-kpi-value">{grade.total} <small>/ 100</small></div>
      <div className="report-kpi-foot">
        PR merge <strong>{git.prMergeHours}h</strong><span>·</span>
        <strong>{git.commitsPerMonth}</strong> commits / month
      </div>
      <details className="framework-card-more">
        <summary aria-label={`Grade ${grade.total} out of 100: show details`}>
          <span className="report-kpi-detail">{git.codeOwnersCoverage}% Code Owners coverage</span>
          <span className="disclosure-pill"><span className="disclosure-icon"><Icon name="chevron" size={16} /></span></span>
        </summary>
        <table className="score-table">
          <thead>
            <tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Score</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">PR merge time</th><td>{git.prMergeHours}h</td><td>{grade.merge}</td></tr>
            <tr><th scope="row">Commits / month</th><td>{git.commitsPerMonth}</td><td>{grade.activity}</td></tr>
            <tr><th scope="row">Code Owners coverage</th><td>{git.codeOwnersCoverage}%</td><td>{grade.owners}</td></tr>
          </tbody>
        </table>
      </details>
    </>
  );
}
