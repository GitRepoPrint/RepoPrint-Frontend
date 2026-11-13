import { getActivity } from "@/lib/github/get-activity";
import { mockInstantReport } from "./mock/instant-report";
import type { InstantReport } from "./types";

/** Repositório usado quando o campo está vazio (modo demo, como no mockup). */
export const DEFAULT_REPOSITORY = "deti-org/payment-service";

export async function analyzeInstant(repository: string): Promise<InstantReport> {
  if (repository === DEFAULT_REPOSITORY) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { ...mockInstantReport, repository, analyzedAt: new Date().toISOString() };
  }

  const [owner, repo]= repository.split("/");
  const { activity, fetchedAt, refreshAvailableAt, cached }= await getActivity(owner, repo);
  const { summary }= mockInstantReport;
  return {
    ...mockInstantReport,
    repository,
    branch: activity.defaultBranch,
    analyzedAt: fetchedAt,
    summary: {
      ...summary,
      git: {
        ...summary.git,
        prMergeHours: activity.medianPrMergeHours,
        commitsPerMonth: activity.commitsLast30d,
      },
    },
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
