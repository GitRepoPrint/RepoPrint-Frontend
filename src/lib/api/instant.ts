import { ApiError } from "./errors";
import { mockInstantReport } from "./mock/instant-report";
import type { InstantReport } from "./types";

/** Repositório usado quando o campo está vazio (modo demo, como no mockup). */
export const DEFAULT_REPOSITORY = "deti-org/payment-service";

const ERROR_MESSAGES: Record<number, string> = {
  400: "Enter a valid public GitHub repository URL.",
  404: "Repository not found. It may not exist or may be private.",
  422: "This repository is empty.",
  429: "GitHub rate limit reached. Try again in a few minutes.",
};
const UNAVAILABLE_MESSAGE= "The analysis service did not respond. Please try again.";

interface ActivityResponse {
  default_branch: string;
  median_pr_merge_time: number | null;
  active_contributors: number;
  bots_excluded: number;
  contributors_window: { complete: boolean; commits_read: number; since: string };
  fetched_at: string;
  refresh_available_at: string;
  cached: boolean;
  raw_metrics: { commits_last_30d: number; merged_prs_sampled: number };
}

async function fetchActivity(repository: string): Promise<ActivityResponse> {
  const url= encodeURIComponent(`https://github.com/${repository}`);
  const response= await fetch(`/api/github/activity?url=${url}`);
  if (!response.ok) {
    throw new ApiError(ERROR_MESSAGES[response.status] ?? UNAVAILABLE_MESSAGE, response.status);
  }
  return response.json();
}

export async function analyzeInstant(repository: string): Promise<InstantReport> {
  if (repository === DEFAULT_REPOSITORY) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { ...mockInstantReport, repository, analyzedAt: new Date().toISOString() };
  }

  const activity= await fetchActivity(repository);
  const { summary }= mockInstantReport;
  return {
    ...mockInstantReport,
    repository,
    branch: activity.default_branch,
    analyzedAt: activity.fetched_at,
    summary: {
      ...summary,
      git: {
        ...summary.git,
        prMergeHours: activity.median_pr_merge_time,
        commitsPerMonth: activity.raw_metrics.commits_last_30d,
      },
    },
    activity: {
      fetchedAt: activity.fetched_at,
      refreshAvailableAt: activity.refresh_available_at,
      cached: activity.cached,
      activeContributors: activity.active_contributors,
      botsExcluded: activity.bots_excluded,
      contributorsWindow: {
        complete: activity.contributors_window.complete,
        commitsRead: activity.contributors_window.commits_read,
        since: activity.contributors_window.since,
      },
      mergeSampleSize: activity.raw_metrics.merged_prs_sampled,
    },
  };
}
