import { beforeEach, describe, expect, it, vi } from "vitest";

const getActivity= vi.fn();
vi.mock("@/lib/github/get-activity", () => ({ getActivity }));

const { analyzeInstant }= await import("./instant");

const RESULT= {
  activity: {
    defaultBranch: "main",
    commitsLast30d: 31,
    medianPrMergeHours: 17.5,
    activeContributors: 4,
    botsExcluded: 0,
    contributorsWindow: { complete: true, commitsRead: 91, since: "2026-08-17T10:00:00Z" },
    mergedPrsSampled: 43,
  },
  fetchedAt: "2026-11-15T10:30:00.000Z",
  refreshAvailableAt: "2026-11-15T10:40:00.000Z",
  cached: false,
};

beforeEach(() => {
  getActivity.mockReset();
  getActivity.mockResolvedValue(RESULT);
});

describe("analyzeInstant", () => {
  it("returns only the GitHub numbers", async () => {
    const report= await analyzeInstant("pallets/click");

    expect(report).toEqual({
      repository: "pallets/click",
      branch: "main",
      analyzedAt: RESULT.fetchedAt,
      commitsPerMonth: 31,
      prMergeHours: 17.5,
      activity: {
        fetchedAt: RESULT.fetchedAt,
        refreshAvailableAt: RESULT.refreshAvailableAt,
        cached: false,
        activeContributors: 4,
        botsExcluded: 0,
        contributorsWindow: RESULT.activity.contributorsWindow,
        mergeSampleSize: 43,
      },
    });
    expect(getActivity).toHaveBeenCalledWith("pallets", "click");
  });

  it("asks GitHub even for the old demo repository name", async () => {
    await analyzeInstant("deti-org/payment-service");

    expect(getActivity).toHaveBeenCalledWith("deti-org", "payment-service");
  });
});
