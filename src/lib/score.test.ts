import { describe, expect, it } from "vitest";
import { hygieneGrade } from "./score";

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
