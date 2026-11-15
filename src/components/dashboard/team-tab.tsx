import type { ReactNode } from "react";
import { HygieneChart } from "@/components/dashboard/hygiene-chart";
import { Icon } from "@/components/ui/icon";
import { hygieneGrade } from "@/lib/score";
import type { RepositoryAnalysis } from "@/lib/api/types";

type Tone = "good" | "warn" | "neutral";

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`team-chip ${tone}`}>{children}</span>;
}

function Stat({ label, value, status }: { label: string; value: string; status: ReactNode }) {
  return (
    <div className="team-stat">
      <span className="team-stat-label">{label}</span>
      <strong>{value}</strong>
      {status}
    </div>
  );
}

function Check({ title, status, children, tall }: { title: string; status?: ReactNode; children: ReactNode; tall?: boolean }) {
  return (
    <article className={tall ? "hygiene-check tall" : "hygiene-check"}>
      <header className="hygiene-check-header">
        <h4>{title}</h4>
        {status}
      </header>
      {children}
    </article>
  );
}

export function TeamTab({ analysis }: { analysis: RepositoryAnalysis }) {
  const { team, hygiene } = analysis;
  const { quality, branches, license } = hygiene;
  const activity = { prMergeHours: team.prMergeHours, commitsPerMonth: team.commits30d, codeOwnersCoverage: team.codeOwnersCoverage };
  const grade = hygieneGrade(activity);
  const commitsPerWeek = Math.round(team.commits30d / (30 / 7));
  const otherBranches = branches.total - 1 - branches.protectedBranches.length;

  return (
    <section className="dashboard-section team-page" aria-label="Team Dynamics and Repository Hygiene">
      <section className="team-box" aria-labelledby="team-activity-title">
        <header className="team-box-header">
          <div>
            <h3 id="team-activity-title">Team activity</h3>
            <p>Commits, pull request reviews and code ownership in the last 30 days.</p>
          </div>
          <Chip tone="neutral">{team.contributors.length} active contributors</Chip>
        </header>

        <div className="team-stats">
          <Stat label="Average commits per week" value={String(commitsPerWeek)} status={<Chip tone="neutral">{team.commitsStatus}</Chip>} />
          <Stat label="Median PR merge time" value={`${team.prMergeHours}h`} status={<Chip tone="neutral">{team.prMergeStatus}</Chip>} />
          <Stat label="Code Owners coverage" value={`${team.codeOwnersCoverage}%`} status={<Chip tone="good">{team.codeOwnersStatus}</Chip>} />
        </div>

        <div className="team-table-wrap">
          <table className="team-table">
            <thead>
              <tr><th scope="col">Contributor</th><th scope="col">Commits</th><th scope="col">Review participation</th><th scope="col">Code ownership</th></tr>
            </thead>
            <tbody>
              {team.contributors.map((person) => (
                <tr key={person.initials}>
                  <td>
                    <div className="team-person">
                      <span className={`avatar ${person.color}`}>{person.initials}</span>
                      <div><strong>{person.name}</strong><small>{person.role}</small></div>
                    </div>
                  </td>
                  <td>{person.commits}</td>
                  <td>
                    <div className="team-review">
                      <span className="team-review-bar" aria-hidden="true"><span style={{ width: `${person.reviewParticipation}%` }} /></span>
                      <strong>{person.reviewParticipation}%</strong>
                    </div>
                  </td>
                  <td>{person.ownership}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="team-box" aria-labelledby="repo-hygiene-title">
        <header className="team-box-header">
          <div>
            <h3 id="repo-hygiene-title">Repository hygiene</h3>
            <p>Branch rules, tests and license found through the GitHub API.</p>
          </div>
        </header>

        <div className="hygiene-overview">
          <HygieneChart team={team} />
          <div className="hygiene-grade" role="img" aria-label={`Git hygiene grade ${grade.total} out of 100`}>
            <strong>{grade.total}</strong>
            <span>/ 100</span>
            <small>Git hygiene grade</small>
          </div>
        </div>

        <div className="hygiene-checks">
          <Check tall title="Branch protection" status={branches.protected ? <Chip tone="good">Protected</Chip> : <Chip tone="warn">Not protected</Chip>}>
            <dl className="branch-info">
              <div><dt>Default branch</dt><dd><code>{branches.defaultBranch}</code></dd></div>
              <div>
                <dt>Rules</dt>
                <dd>
                  <ul className="branch-rules">
                    {branches.rules.map((rule) => <li key={rule}><Icon name="check" size={16} />{rule}</li>)}
                  </ul>
                </dd>
              </div>
              {branches.protectedBranches.length > 0 && (
                <div>
                  <dt>Also protected</dt>
                  <dd>
                    <ul className="branch-chips">
                      {branches.protectedBranches.map((name) => <li key={name}><code>{name}</code></li>)}
                    </ul>
                  </dd>
                </div>
              )}
              <div><dt>Not protected</dt><dd>{otherBranches} other branches</dd></div>
            </dl>
          </Check>

          <Check title="Tests and CI" status={<Chip tone={quality.ci.passing ? "good" : "warn"}>{quality.ci.passing ? "Passing" : "Failing"}</Chip>}>
            <p className="hygiene-check-value">{quality.coverage}% test coverage</p>
            <div className="hygiene-bar" role="img" aria-label={`Test coverage: ${quality.coverage} percent`}>
              <span style={{ width: `${quality.coverage}%` }} />
            </div>
          </Check>

          <Check title="License" status={license.osiApproved && <Chip tone="neutral">OSI approved</Chip>}>
            <p className="hygiene-check-value">{license.name}</p>
            {license.commercialUseCompliant && <p className="hygiene-ok"><Icon name="check" size={16} /> Allows commercial use</p>}
          </Check>
        </div>
      </section>
    </section>
  );
}
