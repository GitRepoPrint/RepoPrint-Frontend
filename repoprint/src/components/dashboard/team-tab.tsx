import { Icon } from "@/components/ui/icon";
import type { RepositoryAnalysis } from "@/lib/api/types";

export function TeamTab({ analysis }: { analysis: RepositoryAnalysis }) {
  const { team, hygiene, commit } = analysis;
  const { dependencies, quality, secrets, branches, license } = hygiene;
  // Barra verde = dependências em dia; o resto (âmbar) tem atualização disponível.
  const upToDate = ((dependencies.total - dependencies.updates) / dependencies.total) * 100;

  return (
    <section className="dashboard-section team-hygiene-section">
      <div className="section-header">
        <div><h2>Team Dynamics &amp; Repository Hygiene</h2></div>
        <p>Analysis of contributor cadence, pull request reviews, structural hygiene, CI/tests, and repository secrets.</p>
      </div>
      <div className="team-dynamics-grid">
        <article className="team-panel dynamics-panel">
          <div className="team-panel-heading">
            <div><span className="team-section-kicker">GOVERNANCE &amp; HUMAN ACTIVITY</span><h3>Team Cadence &amp; Review Dynamics</h3></div>
            <span className="team-count-pill">{team.contributors.length} Active Contributors</span>
          </div>
          <div className="team-kpi-grid">
            <article className="team-kpi"><div className="team-kpi-label">30-Day Commits</div><strong>{team.commits30d}</strong><span className="team-status-badge neutral">{team.commitsStatus}</span></article>
            <article className="team-kpi"><div className="team-kpi-label">Avg PR Merge Time</div><strong>{team.prMergeHours}h</strong><span className="team-status-badge neutral">{team.prMergeStatus}</span></article>
            <article className="team-kpi"><div className="team-kpi-label">Code Owners Coverage</div><strong>{team.codeOwnersCoverage}%</strong><span className="team-status-badge green">{team.codeOwnersStatus}</span></article>
          </div>
          <section className="commit-flow-card" aria-labelledby="commit-flow-title">
            <div className="team-subsection-heading">
              <div><h4 id="commit-flow-title">Commit Distribution &amp; PR Flow</h4><p>Last 30 days · repository activity snapshot</p></div>
              <span className="team-status-badge neutral">{team.commits30d} commits</span>
            </div>
            <div className="commit-flow-metrics">
              <div><span>Commit volume</span><strong>{team.commits30d} <small>commits</small></strong></div>
              <div><span>Average PR merge</span><strong>{team.prMergeHours} <small>hours</small></strong></div>
              <div className="weekly-data-note">Weekly totals are not available in this analysis snapshot.</div>
            </div>
          </section>
          <div className="contributors-table-wrap">
            <table className="contributors-table">
              <thead><tr><th>Contributor</th><th>Total commits</th><th>PR Review Participation</th><th>Code Ownership</th></tr></thead>
              <tbody>
                {team.contributors.map((person) => (
                  <tr key={person.initials}>
                    <td><div className="person-cell"><span className={`avatar ${person.color}`}>{person.initials}</span><div><strong>{person.name}</strong><small>{person.role}</small></div></div></td>
                    <td>{person.commits}</td>
                    <td><div className="review-cell"><div className="review-meter"><span style={{ width: `${person.reviewParticipation}%` }} /></div><small>{person.reviewParticipation}%</small></div></td>
                    <td className="ownership-cell">{person.ownership}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="team-panel hygiene-panel">
          <div className="team-panel-heading">
            <div><span className="team-section-kicker">TECHNICAL POSTURE &amp; AUDIT</span><h3>Structural Hygiene &amp; Security Baseline</h3></div>
            <span className="grade-pill">Grade: {hygiene.grade}</span>
          </div>

          <article className="baseline-card secrets-baseline-card">
            <div className="baseline-card-heading">
              <span className="baseline-icon"><Icon name="shield" size={19} /></span>
              <span className={`hygiene-badge ${secrets.exposed === 0 ? "green" : "amber"}`}>{secrets.exposed === 0 ? "CLEAN" : "ACTION NEEDED"}</span>
            </div>
            <h4>{secrets.exposed} Exposed Secrets Detected</h4>
            <p>Scanned depth: {secrets.scannedDepthPercent}% of commit history (entropy, keys, credentials)</p>
          </article>

          <article className="baseline-card branch-hygiene-card">
            <div className="baseline-card-heading"><h4>Branch Governance &amp; Strategy</h4></div>
            <div className="protected-branch">
              <code>{branches.defaultBranch}</code>
              {branches.protected && <span className="hygiene-badge green">Protected</span>}
            </div>
            <ul className="governance-list">{branches.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
            <div className="active-branches">
              <span className="baseline-label">ACTIVE BRANCHES</span>
              {branches.active.map((b) => <span key={b.name}><code>{b.name}</code><small>{b.state}</small></span>)}
            </div>
          </article>

          <article className="baseline-card dependency-baseline-card">
            <div className="baseline-card-heading">
              <h4>Dependencies &amp; Supply Chain</h4>
              <span className="dependency-total">{dependencies.total} <small>production dependencies</small></span>
            </div>
            <p className="lockfile-status"><Icon name="check" size={14} /> Lockfile Present <span>({dependencies.lockfile} verified)</span></p>
            <div className="hygiene-badges">
              <span className={`hygiene-badge ${dependencies.highVulnerabilities === 0 ? "green" : "amber"}`}>{dependencies.highVulnerabilities} High Vulnerabilities</span>
              <span className="hygiene-badge amber">{dependencies.updates} Updates Available</span>
            </div>
            <div className="dependency-progress" role="img" aria-label={`${dependencies.updates} of ${dependencies.total} production dependencies have updates available`}>
              <span style={{ width: `${upToDate}%` }} /><i />
            </div>
            <small className="hygiene-muted">{dependencies.updates} of {dependencies.total} dependencies have updates available</small>
          </article>

          <article className="baseline-card quality-hygiene-card">
            <div className="baseline-card-heading"><h4>Continuous Integration &amp; Testing Baseline</h4></div>
            <div className="baseline-quality-row">
              <div><span className="baseline-label">TEST COVERAGE</span><strong className="coverage-value">{quality.coverage}% Coverage</strong></div>
              <span className={`hygiene-badge ${quality.ci.passing ? "green" : "amber"}`}>{quality.ci.passing ? "Passing" : "Failing"}</span>
            </div>
            <div className="coverage-progress" role="img" aria-label={`Test coverage: ${quality.coverage} percent`}><span style={{ width: `${quality.coverage}%` }} /></div>
            <div className="ci-baseline-row">
              <span className="ci-pulse-dot" />
              <div>
                <strong>{quality.ci.provider} {quality.ci.passing ? "Passing" : "Failing"}</strong>
                <small>Last analyzed commit <code>{commit}</code> · Last run {quality.ci.lastRun}</small>
              </div>
            </div>
          </article>

          <article className="baseline-card license-hygiene-card">
            <div className="baseline-card-heading">
              <h4>Licensing &amp; Legal Hygiene</h4>
              {license.osiApproved && <span className="hygiene-badge neutral">OSI-Approved</span>}
            </div>
            <div className="license-badges"><strong>{license.name}</strong></div>
            {license.commercialUseCompliant && (
              <div className="license-compliant"><Icon name="check" size={15} /><span>Legally Compliant for Commercial Distribution</span></div>
            )}
          </article>
        </article>
      </div>
    </section>
  );
}
