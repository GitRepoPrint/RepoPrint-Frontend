export type GitMetrics = { prMergeHours: number; commitsPerMonth: number; codeOwnersCoverage: number };

const MERGE_BEST_HOURS = 8;
const MERGE_WORST_HOURS = 72;
const COMMITS_FOR_FULL_SCORE = 30;
const WEIGHTS = { merge: 0.35, activity: 0.25, owners: 0.4 };

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function hygieneGrade(git: GitMetrics) {
  const merge = clamp(((MERGE_WORST_HOURS - git.prMergeHours) / (MERGE_WORST_HOURS - MERGE_BEST_HOURS)) * 100);
  const activity = clamp((git.commitsPerMonth / COMMITS_FOR_FULL_SCORE) * 100);
  const owners = clamp(git.codeOwnersCoverage);
  const total = merge * WEIGHTS.merge + activity * WEIGHTS.activity + owners * WEIGHTS.owners;
  return { total: Math.round(total), merge: Math.round(merge), activity: Math.round(activity), owners: Math.round(owners) };
}
