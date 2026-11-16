import { getActivity } from "@/lib/github/get-activity";
import type { InstantReport } from "./types";

export async function analyzeInstant(repository: string): Promise<InstantReport> {
  const [owner, repo]= repository.split("/");
  const { activity, fetchedAt, refreshAvailableAt, cached }= await getActivity(owner, repo);
  return {
    repository,
    branch: activity.defaultBranch,
    analyzedAt: fetchedAt,
    commitsPerMonth: activity.commitsLast30d,
    prMergeHours: activity.medianPrMergeHours,
    activity: {
      fetchedAt,
      refreshAvailableAt,
      cached,
      activeContributors: activity.activeContributors,
      botsExcluded: activity.botsExcluded,
      contributorsWindow: activity.contributorsWindow,
      mergeSampleSize: activity.mergedPrsSampled,
    },
  };
}
