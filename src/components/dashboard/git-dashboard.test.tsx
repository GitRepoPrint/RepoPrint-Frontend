import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardReportDocument } from "@/components/report/dashboard-report-document";
import { toGitAnalysis } from "@/lib/api/git-analysis";
import type { BackendActivity } from "@/lib/api/git-analysis";
import { DashboardHeader } from "./dashboard-header";
import { NotAvailableCard } from "./not-available-card";
import { TeamTab } from "./team-tab";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", { src: String(props.src), alt: String(props.alt ?? "") }),
}));

const BODY: BackendActivity= {
  default_branch: "main",
  total_commits: 1200,
  active_contributors: 7,
  contributors_window: { complete: false, commits_read: 500, since: "2026-10-01T00:00:00Z" },
  bots_excluded: 0,
  median_pr_merge_time: 4.2,
  open_issues: 3,
  fetched_at: "2026-11-15T10:30:00Z",
  refresh_available_at: "2026-11-15T10:40:00Z",
  cached: false,
  raw_metrics: { commits_last_30d: 47, commits_last_90d: 140, commits_per_week_90d: 10.9, open_prs: 5, merged_prs_sampled: 12, stars: 9 },
  commit_sha: "a3f89c1d4e5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c",
  license: { spdx_id: "MIT", name: "MIT License" },
  branches: { names: ["main", "dev", "old"], total: 3, protected: ["main", "dev"], default_protected: true },
  ci: { provider: "GitHub Actions", conclusion: "failure", passing: false, ran_at: "2026-11-14T09:00:00Z" },
  weekly_commits: [1, 2, 3],
  punch_card: Array.from({ length: 7 }, () => Array(24).fill(0)),
  recent_prs: [{ number: 7, hours: 3 }],
  contributors: [
    { login: "ana-dev", commits: 40, last_commit_at: "2026-11-14T09:00:00Z" },
    { login: null, commits: 12, last_commit_at: "2026-11-02T18:30:00Z" },
  ],
};

const html= (body: BackendActivity) => renderToStaticMarkup(<TeamTab analysis={toGitAnalysis("org/repo", body)} />);

describe("team tab with GitHub data", () => {
  const page= html(BODY);

  it("shows the real numbers", () => {
    expect(page).toContain("At least 7 active contributors");
    expect(page).toContain("<strong>11</strong>");
    expect(page).toContain("<strong>4.2h</strong>");
    expect(page).toContain("Based on 12 merged PRs");
    expect(page).toContain("MIT License");
    expect(page).toContain("Failing");
    expect(page).toContain("Protected");
    expect(page).toContain("<code>dev</code>");
    expect(page).toContain("1 other branches");
    expect(page).toContain("Average of 2 commits per week over the last 3 weeks");
  });

  it("lists the contributors with the real commit counts", () => {
    expect(page).toContain("<strong>ana-dev</strong><small>Last commit 14 Nov 2026</small>");
    expect(page).toContain("Unlinked author");
    expect(page).toContain("<td>40</td>");
    expect(page).toContain("Top 2 of at least 7 contributors. Commits since 1 Oct 2026, from the 500 most recent commits. Bots are excluded.");
    expect(page).not.toContain("secret");
  });

  it("says Not available where GitHub gives nothing", () => {
    expect(page).toContain("<strong>Not available</strong>");
    expect(page).toContain("<td>Not available</td><td>Not available</td>");
    expect(page).toContain("Test coverage: Not available");
    expect(page).toContain("Commercial use: Not available");
    expect(page).toContain("Git hygiene grade not available");
    expect(page).toContain("<strong>N/A</strong>");
    expect(page).not.toContain("/ 100");
  });

  it("does not invent a score, owners or coverage", () => {
    expect(page).not.toContain("Enforced");
    expect(page).not.toContain("OSI approved");
    expect(page).not.toContain("Allows commercial use");
  });

  it("degrades when the optional blocks are missing", () => {
    const bare= html({ ...BODY, contributors: [], license: null, branches: null, ci: null, weekly_commits: null, punch_card: null, recent_prs: [], median_pr_merge_time: null });

    expect(bare).toContain('colSpan="4">Not available</td>');
    expect(bare).not.toContain("team-table-note");
    expect(bare).toContain("No license found");
    expect(bare).toContain("<strong>N/A</strong>");
    expect(bare.match(/chart-unavailable/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(bare).toContain("Not available");
  });
});

describe("header and report with GitHub data", () => {
  const analysis= toGitAnalysis("org/repo", BODY);

  it("keeps the header and offers no analysis history", () => {
    const header= renderToStaticMarkup(
      <DashboardHeader
        repository={analysis.repository}
        lastScanned={analysis.lastScanned}
        branches={analysis.branches}
        branch={analysis.defaultBranch}
        onBranchChange={() => undefined}
        scans={analysis.scans}
        scanId=""
        onScanChange={() => undefined}
        onBack={() => undefined}
        onScan={() => undefined}
        onExport={() => undefined}
      />,
    );

    expect(header).toContain("Last scanned at 10:30 UTC");
    expect(header).toMatch(/<option value=""[^>]*>Not available<\/option>/);
  });

  it("prints Not available for the code analysis and real data for the team section", () => {
    const report= renderToStaticMarkup(<DashboardReportDocument analysis={analysis} branch="main" />);

    expect(report).toContain("a3f89c1");
    expect(report.match(/<p[^>]*>Not available<\/p>/g)?.length).toBe(5);
    expect(report).toContain("47 commits in the last 30 days");
    expect(report).toContain("Contributor 1 (40 commits), Contributor 2 (12 commits). Names are withheld in exported reports.");
    expect(report).not.toContain("ana-dev");
    expect(report).toContain("CI checks failing on the latest completed run");
    expect(report).not.toContain("Auth Gateway");
    expect(report).not.toContain("<svg");
  });

  it("renders the Not available card", () => {
    const card= renderToStaticMarkup(<NotAvailableCard title="Threat Modeling" reason="Nothing to show." />);

    expect(card).toContain("team-box");
    expect(card).toContain("Not available");
    expect(card).toContain("Nothing to show.");
  });
});
