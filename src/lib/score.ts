export type GitMetrics = { prMergeHours: number | null; commitsPerMonth: number; codeOwnersCoverage: number | null };
export type ActivityMetrics = Omit<GitMetrics, "codeOwnersCoverage">;

const MERGE_BEST_HOURS = 8;
const MERGE_WORST_HOURS = 72;
const COMMITS_FOR_FULL_SCORE = 30;
const WEIGHTS = { merge: 0.35, activity: 0.25, owners: 0.4 };
const WITHOUT_OWNERS = { merge: WEIGHTS.merge / (WEIGHTS.merge + WEIGHTS.activity), activity: WEIGHTS.activity / (WEIGHTS.merge + WEIGHTS.activity) };

const clamp = (value: number) => Math.min(100, Math.max(0, value));

const mergeScore = (hours: number | null) => hours === null ? 0 : clamp(((MERGE_WORST_HOURS - hours) / (MERGE_WORST_HOURS - MERGE_BEST_HOURS)) * 100);
const activityScore = (commits: number) => clamp((commits / COMMITS_FOR_FULL_SCORE) * 100);

export function hygieneGrade(git: GitMetrics) {
  const merge = mergeScore(git.prMergeHours);
  const activity = activityScore(git.commitsPerMonth);
  if (git.codeOwnersCoverage === null) return { total: null, merge: Math.round(merge), activity: Math.round(activity), owners: null };
  const owners = clamp(git.codeOwnersCoverage);
  const total = merge * WEIGHTS.merge + activity * WEIGHTS.activity + owners * WEIGHTS.owners;
  return { total: Math.round(total), merge: Math.round(merge), activity: Math.round(activity), owners: Math.round(owners) };
}

export function hygieneGradeWithoutOwners(git: ActivityMetrics) {
  const merge = mergeScore(git.prMergeHours);
  const activity = activityScore(git.commitsPerMonth);
  const total = merge * WITHOUT_OWNERS.merge + activity * WITHOUT_OWNERS.activity;
  return { total: Math.round(total), merge: Math.round(merge), activity: Math.round(activity) };
}
