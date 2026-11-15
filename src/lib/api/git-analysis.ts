import { backendFetch } from "@/lib/auth/backend";
import { formatClock } from "@/lib/format";
import type { DfdModel, LoadFailure, RepositoryAnalysis } from "./types";

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
  commit_sha?: string | null;
  license?: { spdx_id: string | null; name: string | null } | null;
  branches?: { names: string[]; total: number; protected: string[]; default_protected: boolean } | null;
  ci?: { provider: string; conclusion: string | null; passing: boolean | null; ran_at: string | null } | null;
  weekly_commits?: number[] | null;
  punch_card?: number[][] | null;
  recent_prs?: { number: number; hours: number }[];
};

export type GitLoad=
  | { status: "ready"; analysis: RepositoryAnalysis }
  | { status: "not-found" }
  | { status: "unauthorized" }
  | { status: "failed"; failure: LoadFailure };

type BackendCall= (path: string, accessToken: string) => Promise<Response>;

const EMPTY_DFD: DfdModel= {
  boundary: { x: 0, y: 0, width: 0, height: 0, label: "" },
  nodes: [],
  flows: [],
  edges: [],
};

const isCount= (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isDate= (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isRecord= (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isText= (value: unknown): value is string => typeof value === "string";
const orNull= <T>(value: unknown, check: (item: unknown) => item is T): boolean => value === undefined || value === null || check(value);

const isLicense= (value: unknown) =>
  isRecord(value) && (value.spdx_id === null || isText(value.spdx_id)) && (value.name === null || isText(value.name));

const isBranches= (value: unknown) =>
  isRecord(value) &&
  Array.isArray(value.names) && value.names.every(isText) &&
  isCount(value.total) &&
  Array.isArray(value.protected) && value.protected.every(isText) &&
  typeof value.default_protected === "boolean";

const isCi= (value: unknown) =>
  isRecord(value) &&
  isText(value.provider) &&
  (value.conclusion === null || isText(value.conclusion)) &&
  (value.passing === null || typeof value.passing === "boolean") &&
  (value.ran_at === null || isDate(value.ran_at));

const isWeekly= (value: unknown) => Array.isArray(value) && value.every(isCount);

const isPunchCard= (value: unknown) =>
  Array.isArray(value) && value.length === 7 && value.every((day) => Array.isArray(day) && day.length === 24 && day.every(isCount));

const isRecentPrs= (value: unknown) =>
  Array.isArray(value) && value.every((pr) => isRecord(pr) && isCount(pr.number) && isCount(pr.hours));

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
    [raw.commits_last_30d, raw.commits_last_90d, raw.commits_per_week_90d, raw.open_prs, raw.merged_prs_sampled, raw.stars].every(isCount) &&
    orNull(value.commit_sha, isText) &&
    (value.license == null || isLicense(value.license)) &&
    (value.branches == null || isBranches(value.branches)) &&
    (value.ci == null || isCi(value.ci)) &&
    (value.weekly_commits == null || isWeekly(value.weekly_commits)) &&
    (value.punch_card == null || isPunchCard(value.punch_card)) &&
    (value.recent_prs === undefined || isRecentPrs(value.recent_prs))
  );
}

function branchNames(body: BackendActivity): string[] {
  const names= body.branches?.names ?? [];
  return [body.default_branch, ...names.filter((name) => name !== body.default_branch)];
}

export function toGitAnalysis(repository: string, body: BackendActivity): RepositoryAnalysis {
  const raw= body.raw_metrics;
  const branches= body.branches ?? null;
  const weekly= body.weekly_commits?.length ? body.weekly_commits : null;
  const prs= body.recent_prs?.length ? body.recent_prs : null;
  const license= body.license ?? null;

  return {
    source: "git",
    repository,
    commit: body.commit_sha ? body.commit_sha.slice(0, 7) : null,
    branches: branchNames(body),
    defaultBranch: body.default_branch,
    analyzedAt: body.fetched_at,
    lastScanned: `at ${formatClock(body.fetched_at, "UTC")}`,
    executiveSummary: null,
    scans: [],
    findings: [],
    dfd: EMPTY_DFD,
    team: {
      commits30d: raw.commits_last_30d,
      commitsStatus: null,
      prMergeHours: body.median_pr_merge_time,
      prMergeStatus: raw.merged_prs_sampled ? `Based on ${raw.merged_prs_sampled} merged PRs` : "No merged PRs",
      codeOwnersCoverage: null,
      codeOwnersStatus: null,
      weeklyCommits: weekly,
      recentPrs: prs,
      punchCard: body.punch_card ?? null,
      contributors: null,
      activeContributors: body.contributors_window.complete ? String(body.active_contributors) : `At least ${body.active_contributors}`,
      timeZone: "UTC",
    },
    hygiene: {
      languages: null,
      branches: {
        defaultBranch: body.default_branch,
        protected: branches ? branches.default_protected : null,
        rules: null,
        protectedBranches: branches ? branches.protected.filter((name) => name !== body.default_branch) : [],
        total: branches ? branches.total : null,
      },
      quality: {
        coverage: null,
        ci: body.ci ? { provider: body.ci.provider, passing: body.ci.passing, lastRun: body.ci.ran_at ?? "" } : null,
      },
      license: {
        name: license ? (license.name ?? license.spdx_id) : null,
        osiApproved: null,
        commercialUseCompliant: null,
      },
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
