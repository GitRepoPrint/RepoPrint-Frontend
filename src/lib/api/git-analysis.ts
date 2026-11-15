import { backendFetch } from "@/lib/auth/backend";
import type { GitAnalysis, LoadFailure } from "./types";

export type BackendActivity= {
  default_branch: string;
  total_commits: number;
  active_contributors: number;
  contributors_window: { complete: boolean; commits_read: number; since: string };
  bots_excluded: number;
  median_pr_merge_time: number | null;
  open_issues: number;
  fetched_at: string;
  refresh_available_at: string;
  cached: boolean;
  raw_metrics: {
    commits_last_30d: number;
    commits_last_90d: number;
    commits_per_week_90d: number;
    open_prs: number;
    merged_prs_sampled: number;
    stars: number;
  };
};

export type GitLoad=
  | { status: "ready"; analysis: GitAnalysis }
  | { status: "not-found" }
  | { status: "unauthorized" }
  | { status: "failed"; failure: LoadFailure };

type BackendCall= (path: string, accessToken: string) => Promise<Response>;

const isCount= (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isDate= (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isRecord= (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function isBackendActivity(value: unknown): value is BackendActivity {
  if (!isRecord(value) || !isRecord(value.contributors_window) || !isRecord(value.raw_metrics)) return false;
  const window= value.contributors_window;
  const raw= value.raw_metrics;
  return (
    typeof value.default_branch === "string" &&
    [value.total_commits, value.active_contributors, value.bots_excluded, value.open_issues].every(isCount) &&
    (value.median_pr_merge_time === null || isCount(value.median_pr_merge_time)) &&
    isDate(value.fetched_at) &&
    isDate(value.refresh_available_at) &&
    typeof value.cached === "boolean" &&
    typeof window.complete === "boolean" &&
    isCount(window.commits_read) &&
    isDate(window.since) &&
    [raw.commits_last_30d, raw.commits_last_90d, raw.commits_per_week_90d, raw.open_prs, raw.merged_prs_sampled, raw.stars].every(isCount)
  );
}

export function toGitAnalysis(repository: string, body: BackendActivity): GitAnalysis {
  const raw= body.raw_metrics;
  return {
    mode: "git",
    repository,
    analyzedAt: body.fetched_at,
    git: {
      defaultBranch: body.default_branch,
      totalCommits: body.total_commits,
      commitsLast30d: raw.commits_last_30d,
      commitsLast90d: raw.commits_last_90d,
      commitsPerWeek90d: raw.commits_per_week_90d,
      medianPrMergeHours: body.median_pr_merge_time,
      openPrs: raw.open_prs,
      openIssues: body.open_issues,
      stars: raw.stars,
    },
    activity: {
      fetchedAt: body.fetched_at,
      refreshAvailableAt: body.refresh_available_at,
      cached: body.cached,
      activeContributors: body.active_contributors,
      botsExcluded: body.bots_excluded,
      contributorsWindow: {
        complete: body.contributors_window.complete,
        commitsRead: body.contributors_window.commits_read,
        since: body.contributors_window.since,
      },
      mergeSampleSize: raw.merged_prs_sampled,
    },
  };
}

const FAILURES: Record<number, LoadFailure>= {
  409: {
    title: "GitHub connection needs attention",
    message: "Your GitHub connection is no longer valid. Connect GitHub again from the profile menu.",
    retryable: false,
  },
  422: {
    title: "This repository is empty",
    message: "It has no commits yet, so there is nothing to read. Push a first commit, then open this page again.",
    retryable: true,
  },
  429: {
    title: "GitHub rate limit reached",
    message: "GitHub is limiting requests for now. Try again in a few minutes.",
    retryable: true,
  },
  502: {
    title: "GitHub did not respond",
    message: "The request to GitHub failed. Try again in a moment.",
    retryable: true,
  },
  503: {
    title: "RepoPrint is not available",
    message: "The RepoPrint server cannot reach a service it needs. Try again in a moment.",
    retryable: true,
  },
};

const GENERIC_FAILURE: LoadFailure= {
  title: "Could not read this repository",
  message: "Something went wrong while reading the GitHub data. Try again in a moment.",
  retryable: true,
};

const UNREACHABLE: LoadFailure= {
  title: "RepoPrint server not reachable",
  message: "This page could not reach the RepoPrint server. Check that it is running, then try again.",
  retryable: true,
};

export function failureFor(status: number): LoadFailure {
  return FAILURES[status] ?? GENERIC_FAILURE;
}

export async function fetchGitAnalysis(
  repository: string,
  accessToken: string,
  call: BackendCall= backendFetch,
): Promise<GitLoad> {
  const url= `https://github.com/${repository}`;
  let response: Response;
  try {
    response= await call(`/github/activity?url=${encodeURIComponent(url)}`, accessToken);
  } catch {
    return { status: "failed", failure: UNREACHABLE };
  }
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 401) return { status: "unauthorized" };
  if (!response.ok) return { status: "failed", failure: failureFor(response.status) };

  const body: unknown= await response.json().catch(() => null);
  if (!isBackendActivity(body)) return { status: "failed", failure: failureFor(502) };
  return { status: "ready", analysis: toGitAnalysis(repository, body) };
}
