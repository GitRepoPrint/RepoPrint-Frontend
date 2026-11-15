import { Check, Chip, Stat } from "@/components/dashboard/team-tab";
import { DATA_TIME_ZONE, activityNotes, contributorsValue, mergeSampleText, plural } from "@/lib/activity-notes";
import { formatHours, formatReportDate } from "@/lib/format";
import type { GitAnalysis } from "@/lib/api/types";

const UNAVAILABLE= <Chip tone="neutral">Not available yet</Chip>;

export function GitTeamTab({ analysis }: { analysis: GitAnalysis }) {
  const { git, activity }= analysis;
  const readWindow= activity.contributorsWindow;
  const rows= activityNotes(activity, git.commitsLast30d, git.medianPrMergeHours, DATA_TIME_ZONE);

  return (
    <section className="dashboard-section team-page" aria-label="Team Dynamics and Repository Hygiene">
      <section className="team-box" aria-labelledby="git-activity-title">
        <header className="team-box-header">
          <div>
            <h3 id="git-activity-title">Team activity</h3>
            <p>Commits, contributors and pull requests read from the GitHub API, on the default branch.</p>
          </div>
        </header>

        <div className="team-stats">
          <Stat
            label="Commits, last 30 days"
            value={String(git.commitsLast30d)}
            status={<Chip tone="neutral">{git.commitsLast90d} in 90 days</Chip>}
          />
          <Stat
            label="Average commits per week"
            value={String(git.commitsPerWeek90d)}
            status={<Chip tone="neutral">Last 90 days</Chip>}
          />
          <Stat
            label="Active contributors"
            value={contributorsValue(activity)}
            status={
              <>
                <Chip tone="neutral">{readWindow.complete ? "Last 90 days" : `Since ${formatReportDate(readWindow.since)}`}</Chip>
                {activity.botsExcluded > 0 && <Chip tone="neutral">{plural(activity.botsExcluded, "bot")} excluded</Chip>}
              </>
            }
          />
          <Stat
            label="Median PR merge time"
            value={formatHours(git.medianPrMergeHours)}
            status={<Chip tone="neutral">{mergeSampleText(activity.mergeSampleSize)}</Chip>}
          />
        </div>

        <div className="hygiene-checks">
          <Check title="Contributors by name" status={UNAVAILABLE}>
            <p>The per-person table with commits, reviews and ownership needs data this release does not read yet.</p>
          </Check>
          <Check title="Code Owners coverage" status={UNAVAILABLE}>
            <p>It needs the CODEOWNERS file, which this release does not read yet.</p>
          </Check>
        </div>
      </section>

      <section className="team-box" aria-labelledby="git-hygiene-title">
        <header className="team-box-header">
          <div>
            <h3 id="git-hygiene-title">Repository hygiene</h3>
            <p>Facts from the GitHub API. Checks that need more data are marked as not available yet.</p>
          </div>
        </header>

        <div className="team-stats">
          <Stat label="Total commits" value={String(git.totalCommits)} status={<Chip tone="neutral">Default branch</Chip>} />
          <Stat label="Open pull requests" value={String(git.openPrs)} status={null} />
          <Stat label="Open issues" value={String(git.openIssues)} status={<Chip tone="neutral">Pull requests not counted</Chip>} />
          <Stat label="Stars" value={String(git.stars)} status={null} />
        </div>

        <div className="hygiene-checks">
          <Check title="Branch protection" status={UNAVAILABLE}>
            <dl className="branch-info">
              <div><dt>Default branch</dt><dd><code>{git.defaultBranch}</code></dd></div>
            </dl>
            <p>Protection rules are not read yet.</p>
          </Check>
          <Check title="Tests and CI" status={UNAVAILABLE}>
            <p>Test coverage and CI results are not read yet.</p>
          </Check>
          <Check title="License" status={UNAVAILABLE}>
            <p>The license is not read yet.</p>
          </Check>
          <Check title="Git hygiene grade" status={UNAVAILABLE}>
            <p>The grade needs Code Owners coverage. A grade from the remaining data alone would be misleading, so none is shown.</p>
          </Check>
        </div>
      </section>

      <section className="team-box" aria-labelledby="git-notes-title">
        <header className="team-box-header">
          <div>
            <h3 id="git-notes-title">How these numbers are measured</h3>
          </div>
        </header>
        <dl className="data-notes">
          {rows.map((row) => (
            <div key={row.metric}>
              <dt>{row.metric}</dt>
              <dd><strong>{row.value}</strong><span>{row.rule}</span></dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  );
}
