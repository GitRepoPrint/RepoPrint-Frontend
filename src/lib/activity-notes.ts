import type { ActivityInfo } from "@/lib/api/types";
import { formatClock, formatHours, formatReportDate } from "@/lib/format";

export interface NoteRow {
  metric: string;
  value: string;
  rule: string;
}

const plural= (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function activityNotes(activity: ActivityInfo, commitsPerMonth: number, mergeHours: number | null): NoteRow[] {
  const contributors= activity.contributorsWindow;
  const bots= activity.botsExcluded > 0 ? `Bots are not counted (${activity.botsExcluded} excluded).` : "Bots are not counted.";
  const minutes= Math.round((Date.parse(activity.refreshAvailableAt) - Date.parse(activity.fetchedAt)) / 60000);

  return [
    {
      metric: "Commits / month",
      value: String(commitsPerMonth),
      rule: "Commits in the last 30 days, counted by commit date on the default branch. Merge commits are included.",
    },
    {
      metric: "Active contributors",
      value: contributors.complete ? String(activity.activeContributors) : `At least ${activity.activeContributors}`,
      rule: contributors.complete
        ? `People with commits in the last 90 days. ${bots}`
        : `Only the latest ${contributors.commitsRead} commits are read, back to ${formatReportDate(contributors.since)}, so the real number can be higher. ${bots}`,
    },
    {
      metric: "Median PR merge time",
      value: mergeHours === null ? "N/A" : `${formatHours(mergeHours)} (${plural(activity.mergeSampleSize, "PR")})`,
      rule: "Median time from opening to merge, over the merged pull requests among the last 100 closed. N/A when none was merged.",
    },
    {
      metric: "Data",
      value: activity.cached ? `Saved at ${formatClock(activity.fetchedAt)}` : `Read at ${formatClock(activity.fetchedAt)}`,
      rule: activity.cached
        ? `This result was read earlier. Fresh data is available after ${formatClock(activity.refreshAvailableAt)}.`
        : `Read from GitHub just now. Analyzing the same repository again within ${minutes} minutes shows this result.`,
    },
  ];
}

export function cachedMessage(activity: ActivityInfo): string {
  return `Showing the result from ${formatClock(activity.fetchedAt)}. Wait until ${formatClock(activity.refreshAvailableAt)} to analyze this repository again.`;
}
