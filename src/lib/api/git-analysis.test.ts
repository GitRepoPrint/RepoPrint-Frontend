import { describe, expect, it, vi } from "vitest";
import { failureFor, fetchGitAnalysis, isBackendActivity, toGitAnalysis } from "./git-analysis";
import type { BackendActivity } from "./git-analysis";

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
};

const reply= (status: number, body: unknown= BODY) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("toGitAnalysis", () => {
  it("maps the backend fields to the git model", () => {
    const analysis= toGitAnalysis("org/repo", BODY);

    expect(analysis.mode).toBe("git");
    expect(analysis.repository).toBe("org/repo");
    expect(analysis.analyzedAt).toBe(BODY.fetched_at);
    expect(analysis.git).toEqual({
      defaultBranch: "main",
      totalCommits: 1200,
      commitsLast30d: 47,
      commitsLast90d: 140,
      commitsPerWeek90d: 10.9,
      medianPrMergeHours: 4.2,
      openPrs: 5,
      openIssues: 31,
      stars: 980,
    });
    expect(analysis.activity).toEqual({
      fetchedAt: BODY.fetched_at,
      refreshAvailableAt: BODY.refresh_available_at,
      cached: false,
      activeContributors: 7,
      botsExcluded: 2,
      contributorsWindow: { complete: true, commitsRead: 140, since: "2026-08-17T10:00:00Z" },
      mergeSampleSize: 12,
    });
  });

  it("keeps an incomplete contributors window", () => {
    const analysis= toGitAnalysis("org/repo", {
      ...BODY,
      contributors_window: { complete: false, commits_read: 500, since: "2026-10-01T00:00:00Z" },
    });

    expect(analysis.activity.contributorsWindow).toEqual({ complete: false, commitsRead: 500, since: "2026-10-01T00:00:00Z" });
  });

  it("keeps a null merge time and zero counts without inventing values", () => {
    const analysis= toGitAnalysis("org/repo", {
      ...BODY,
      median_pr_merge_time: null,
      open_issues: 0,
      raw_metrics: { ...BODY.raw_metrics, commits_last_30d: 0, open_prs: 0, merged_prs_sampled: 0, stars: 0 },
    });

    expect(analysis.git.medianPrMergeHours).toBeNull();
    expect(analysis.git.commitsLast30d).toBe(0);
    expect(analysis.git.openPrs).toBe(0);
    expect(analysis.git.openIssues).toBe(0);
    expect(analysis.git.stars).toBe(0);
    expect(analysis.activity.mergeSampleSize).toBe(0);
  });

  it("keeps the cached flag", () => {
    expect(toGitAnalysis("org/repo", { ...BODY, cached: true }).activity.cached).toBe(true);
  });
});

describe("isBackendActivity", () => {
  it("accepts a full answer, with or without a merge time", () => {
    expect(isBackendActivity(BODY)).toBe(true);
    expect(isBackendActivity({ ...BODY, median_pr_merge_time: null })).toBe(true);
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
    if (load.status === "ready") expect(load.analysis.git.defaultBranch).toBe("main");
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
