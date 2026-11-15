import { describe, expect, it, vi } from "vitest";
import { failureFor, fetchGitAnalysis, isBackendActivity, toGitAnalysis } from "./git-analysis";
import type { BackendActivity } from "./git-analysis";

const WEEKS= [8, 12, 9, 14, 11, 7, 13, 10, 12, 11, 13, 11];
const PUNCH= Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => (day === 2 && hour === 11 ? 5 : 0)));

const BODY: BackendActivity= {
  default_branch: "main",
  total_commits: 1200,
  active_contributors: 7,
  contributors_window: { complete: true, commits_read: 140, since: "2026-08-17T10:00:00Z" },
  bots_excluded: 2,
  median_pr_merge_time: 4.2,
  open_issues: 31,
  fetched_at: "2026-11-15T10:30:00.123456Z",
  refresh_available_at: "2026-11-15T10:40:00.123456Z",
  cached: false,
  raw_metrics: {
    commits_last_30d: 47,
    commits_last_90d: 140,
    commits_per_week_90d: 10.9,
    open_prs: 5,
    merged_prs_sampled: 12,
    stars: 980,
  },
  commit_sha: "a3f89c1d4e5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c",
  license: { spdx_id: "MIT", name: "MIT License" },
  branches: { names: ["main", "develop", "release/v2"], total: 3, protected: ["main", "release/v2"], default_protected: true },
  ci: { provider: "GitHub Actions", conclusion: "success", passing: true, ran_at: "2026-11-14T09:00:00Z" },
  weekly_commits: WEEKS,
  punch_card: PUNCH,
  recent_prs: [{ number: 431, hours: 2.1 }, { number: 434, hours: 5.5 }],
  contributors: [
    { login: "ana-dev", commits: 40, last_commit_at: "2026-11-14T09:00:00Z" },
    { login: null, commits: 12, last_commit_at: "2026-11-02T18:30:00Z" },
  ],
};

const reply= (status: number, body: unknown= BODY) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("toGitAnalysis", () => {
  it("maps the backend fields to the dashboard model", () => {
    const analysis= toGitAnalysis("org/repo", BODY);

    expect(analysis.source).toBe("git");
    expect(analysis.repository).toBe("org/repo");
    expect(analysis.commit).toBe("a3f89c1");
    expect(analysis.defaultBranch).toBe("main");
    expect(analysis.branches).toEqual(["main", "develop", "release/v2"]);
    expect(analysis.analyzedAt).toBe(BODY.fetched_at);
    expect(analysis.lastScanned).toBe("at 10:30 UTC");
    expect(analysis.team).toMatchObject({
      commits30d: 47,
      prMergeHours: 4.2,
      prMergeStatus: "Based on 12 merged PRs",
      weeklyCommits: WEEKS,
      punchCard: PUNCH,
      recentPrs: [{ number: 431, hours: 2.1 }, { number: 434, hours: 5.5 }],
      activeContributors: "7",
      timeZone: "UTC",
    });
    expect(analysis.hygiene.branches).toEqual({ defaultBranch: "main", protected: true, rules: null, protectedBranches: ["release/v2"], total: 3 });
    expect(analysis.hygiene.quality.ci).toEqual({ provider: "GitHub Actions", passing: true, lastRun: "2026-11-14T09:00:00Z" });
    expect(analysis.hygiene.license.name).toBe("MIT License");
  });

  it("leaves unavailable data empty instead of inventing it", () => {
    const { team, hygiene, findings, scans, executiveSummary }= toGitAnalysis("org/repo", BODY);

    expect(team.codeOwnersCoverage).toBeNull();
    expect(team.codeOwnersStatus).toBeNull();
    expect(team.commitsStatus).toBeNull();
    expect(team.contributors?.every((person) => person.reviewParticipation === null && person.ownership === null)).toBe(true);
    expect(hygiene.languages).toBeNull();
    expect(hygiene.quality.coverage).toBeNull();
    expect(hygiene.license.osiApproved).toBeNull();
    expect(hygiene.license.commercialUseCompliant).toBeNull();
    expect(findings).toEqual([]);
    expect(scans).toEqual([]);
    expect(executiveSummary).toBeNull();
  });

  it("marks the contributors as a minimum when the window is incomplete", () => {
    const analysis= toGitAnalysis("org/repo", {
      ...BODY,
      contributors_window: { complete: false, commits_read: 500, since: "2026-10-01T00:00:00Z" },
    });

    expect(analysis.team.activeContributors).toBe("At least 7");
  });

  it("keeps a null merge time and zero counts without inventing values", () => {
    const analysis= toGitAnalysis("org/repo", {
      ...BODY,
      median_pr_merge_time: null,
      recent_prs: [],
      raw_metrics: { ...BODY.raw_metrics, commits_last_30d: 0, merged_prs_sampled: 0 },
    });

    expect(analysis.team.prMergeHours).toBeNull();
    expect(analysis.team.prMergeStatus).toBe("No merged PRs");
    expect(analysis.team.recentPrs).toBeNull();
    expect(analysis.team.commits30d).toBe(0);
  });

  it("handles a backend that does not send the detail blocks", () => {
    const { commit_sha, license, branches, ci, weekly_commits, punch_card, recent_prs, ...old }= BODY;
    void [commit_sha, license, branches, ci, weekly_commits, punch_card, recent_prs];

    const analysis= toGitAnalysis("org/repo", old);

    expect(analysis.commit).toBeNull();
    expect(analysis.branches).toEqual(["main"]);
    expect(analysis.team.weeklyCommits).toBeNull();
    expect(analysis.team.punchCard).toBeNull();
    expect(analysis.hygiene.branches).toMatchObject({ protected: null, total: null, protectedBranches: [] });
    expect(analysis.hygiene.quality.ci).toBeNull();
    expect(analysis.hygiene.license.name).toBeNull();
  });

  it("puts the default branch first and keeps a CI run without a verdict", () => {
    const analysis= toGitAnalysis("org/repo", {
      ...BODY,
      branches: { names: ["dev", "main"], total: 2, protected: ["dev"], default_protected: false },
      ci: { provider: "GitHub Actions", conclusion: "cancelled", passing: null, ran_at: null },
    });

    expect(analysis.branches).toEqual(["main", "dev"]);
    expect(analysis.hygiene.branches).toMatchObject({ protected: false, protectedBranches: ["dev"] });
    expect(analysis.hygiene.quality.ci).toEqual({ provider: "GitHub Actions", passing: null, lastRun: "" });
  });

  it("falls back to the SPDX id when the license has no name", () => {
    const analysis= toGitAnalysis("org/repo", { ...BODY, license: { spdx_id: "NOASSERTION", name: null } });

    expect(analysis.hygiene.license.name).toBe("NOASSERTION");
  });
});

describe("contributors", () => {
  it("maps the ranking to the table without inventing review or ownership data", () => {
    const { contributors }= toGitAnalysis("org/repo", BODY).team;

    expect(contributors).toEqual([
      { initials: "AN", name: "ana-dev", role: "Last commit 14 Nov 2026", commits: 40, reviewParticipation: null, ownership: null, color: "lavender" },
      { initials: "?", name: "Unlinked author", role: "Last commit 2 Nov 2026", commits: 12, reviewParticipation: null, ownership: null, color: "peach" },
    ]);
  });

  it("explains the window and the limit under the table", () => {
    const complete= toGitAnalysis("org/repo", BODY).team.contributorsNote;
    const partial= toGitAnalysis("org/repo", {
      ...BODY,
      active_contributors: 49,
      contributors_window: { complete: false, commits_read: 500, since: "2026-10-30T00:00:00Z" },
    }).team.contributorsNote;

    expect(complete).toBe("Top 2 of 7 contributors. Commits in the last 90 days. Bots are excluded.");
    expect(partial).toBe("Top 2 of at least 49 contributors. Commits since 30 Oct 2026, from the 500 most recent commits. Bots are excluded.");
  });

  it("has no table when GitHub returned no commits or the backend is older", () => {
    const { contributors, ...old }= BODY;
    void contributors;

    expect(toGitAnalysis("org/repo", { ...BODY, contributors: [] }).team.contributors).toBeNull();
    expect(toGitAnalysis("org/repo", old).team.contributors).toBeNull();
    expect(toGitAnalysis("org/repo", old).team.contributorsNote).toBeUndefined();
  });

  it.each([
    ["a text commit count", [{ login: "a", commits: "3", last_commit_at: "2026-11-14T09:00:00Z" }]],
    ["a bad date", [{ login: "a", commits: 3, last_commit_at: "yesterday" }]],
    ["a numeric login", [{ login: 5, commits: 3, last_commit_at: "2026-11-14T09:00:00Z" }]],
  ])("rejects %s", (_name, value) => {
    expect(isBackendActivity({ ...BODY, contributors: value })).toBe(false);
  });
});

describe("isBackendActivity", () => {
  it("accepts a full answer, with or without a merge time", () => {
    expect(isBackendActivity(BODY)).toBe(true);
    expect(isBackendActivity({ ...BODY, median_pr_merge_time: null })).toBe(true);
    expect(isBackendActivity({ ...BODY, license: null, branches: null, ci: null, weekly_commits: null, punch_card: null, commit_sha: null })).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "text"],
    ["no raw metrics", { ...BODY, raw_metrics: undefined }],
    ["a missing default branch", { ...BODY, default_branch: undefined }],
    ["a negative count", { ...BODY, total_commits: -1 }],
    ["a text count", { ...BODY, open_issues: "3" }],
    ["a bad date", { ...BODY, fetched_at: "yesterday" }],
    ["a missing window", { ...BODY, contributors_window: null }],
    ["a missing raw metric", { ...BODY, raw_metrics: { ...BODY.raw_metrics, stars: undefined } }],
    ["a bad license", { ...BODY, license: { spdx_id: 3, name: null } }],
    ["branches without a total", { ...BODY, branches: { ...BODY.branches, total: "3" } }],
    ["a punch card with the wrong size", { ...BODY, punch_card: [[1, 2]] }],
    ["weeks that are not counts", { ...BODY, weekly_commits: [1, "x"] }],
    ["a CI block without provider", { ...BODY, ci: { conclusion: "success", passing: true, ran_at: null } }],
    ["pull requests without hours", { ...BODY, recent_prs: [{ number: 1 }] }],
  ])("rejects %s", (_name, value) => {
    expect(isBackendActivity(value)).toBe(false);
  });
});

describe("fetchGitAnalysis", () => {
  it("asks the backend for the repository with the user token", async () => {
    const call= reply(200);

    const load= await fetchGitAnalysis("org/repo", "token-1", call);

    expect(call).toHaveBeenCalledWith("/github/activity?url=https%3A%2F%2Fgithub.com%2Forg%2Frepo", "token-1");
    expect(load.status).toBe("ready");
    if (load.status === "ready") expect(load.analysis.defaultBranch).toBe("main");
  });

  it("returns not-found for a 404", async () => {
    expect(await fetchGitAnalysis("org/repo", "t", reply(404, { detail: "x" }))).toEqual({ status: "not-found" });
  });

  it("returns unauthorized for a 401", async () => {
    expect(await fetchGitAnalysis("org/repo", "t", reply(401, { detail: "x" }))).toEqual({ status: "unauthorized" });
  });

  it("tells the user to connect GitHub again on a 409", async () => {
    const load= await fetchGitAnalysis("org/repo", "t", reply(409, { detail: "ligação inválida" }));

    expect(load).toEqual({
      status: "failed",
      failure: {
        title: "GitHub connection needs attention",
        message: "Your GitHub connection is no longer valid. Connect GitHub again from the profile menu.",
        retryable: false,
      },
    });
  });

  it.each([
    [422, "This repository is empty", true],
    [429, "GitHub rate limit reached", true],
    [502, "GitHub did not respond", true],
    [503, "RepoPrint is not available", true],
    [500, "Could not read this repository", true],
    [400, "Could not read this repository", true],
  ])("explains a %i answer", async (status, title, retryable) => {
    const load= await fetchGitAnalysis("org/repo", "t", reply(status, { detail: "texto do servidor" }));

    expect(load.status).toBe("failed");
    if (load.status === "failed") {
      expect(load.failure.title).toBe(title);
      expect(load.failure.retryable).toBe(retryable);
      expect(load.failure.message).not.toContain("servidor");
    }
  });

  it("reports an unreachable backend instead of throwing", async () => {
    const down= vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const load= await fetchGitAnalysis("org/repo", "t", down);

    expect(load.status).toBe("failed");
    if (load.status === "failed") expect(load.failure.title).toBe("RepoPrint server not reachable");
  });

  it("treats an answer with the wrong shape as a failed GitHub call", async () => {
    const load= await fetchGitAnalysis("org/repo", "t", reply(200, { default_branch: "main" }));

    expect(load).toEqual({ status: "failed", failure: failureFor(502) });
  });

  it("treats a body that is not JSON as a failed GitHub call", async () => {
    const call= vi.fn(async () => new Response("<html>", { status: 200 }));

    expect(await fetchGitAnalysis("org/repo", "t", call)).toEqual({ status: "failed", failure: failureFor(502) });
  });
});
