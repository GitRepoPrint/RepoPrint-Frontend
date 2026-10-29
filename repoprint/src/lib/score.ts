import type { Finding, Severity } from "@/lib/api/types";

export const SEVERITIES: Severity[] = ["high", "medium", "low"];
export const SEVERITY_PENALTY: Record<Severity, number> = { high: 4, medium: 2, low: 1 };

export type ScoreBand = { id: "excellent" | "good" | "fair" | "critical"; min: number; label: string };

export const SCORE_BANDS: ScoreBand[] = [
  { id: "excellent", min: 90, label: "Excellent" },
  { id: "good", min: 75, label: "Good" },
  { id: "fair", min: 50, label: "Needs work" },
  { id: "critical", min: 0, label: "Critical" },
];

export const bandOf = (score: number): ScoreBand => SCORE_BANDS.find((band) => score >= band.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];

export type SecurityScore = {
  total: number;
  band: ScoreBand;
  counts: Record<Severity, number>;
  points: Record<Severity, number>;
};

export function securityScore(findings: Finding[]): SecurityScore {
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  const points: Record<Severity, number> = {
    high: counts.high * SEVERITY_PENALTY.high,
    medium: counts.medium * SEVERITY_PENALTY.medium,
    low: counts.low * SEVERITY_PENALTY.low,
  };
  const total = Math.max(0, 100 - points.high - points.medium - points.low);
  return { total, band: bandOf(total), counts, points };
}

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
