import { describe, expect, it } from "vitest";
import { hygieneGrade, hygieneGradeWithoutOwners } from "./score";

describe("hygieneGrade", () => {
  it("weights merge time, activity and Code Owners", () => {
    expect(hygieneGrade({ prMergeHours: 4.2, commitsPerMonth: 47, codeOwnersCoverage: 92 })).toEqual({ total: 97, merge: 100, activity: 100, owners: 92 });
  });

  it("has no total and no Code Owners score without the coverage, but keeps the other scores", () => {
    expect(hygieneGrade({ prMergeHours: 40, commitsPerMonth: 15, codeOwnersCoverage: null })).toEqual({ total: null, merge: 50, activity: 50, owners: null });
  });

  it("counts zero coverage and a missing merge time as zero", () => {
    expect(hygieneGrade({ prMergeHours: null, commitsPerMonth: 0, codeOwnersCoverage: 0 })).toEqual({ total: 0, merge: 0, activity: 0, owners: 0 });
  });
});

describe("hygieneGradeWithoutOwners", () => {
  it("keeps the merge time above the activity, as in the full grade", () => {
    expect(hygieneGradeWithoutOwners({ prMergeHours: 4.2, commitsPerMonth: 0 })).toEqual({ total: 58, merge: 100, activity: 0 });
    expect(hygieneGradeWithoutOwners({ prMergeHours: null, commitsPerMonth: 30 })).toEqual({ total: 42, merge: 0, activity: 100 });
  });

  it("counts a missing merge time as zero", () => {
    expect(hygieneGradeWithoutOwners({ prMergeHours: null, commitsPerMonth: 15 })).toEqual({ total: 21, merge: 0, activity: 50 });
  });
});
