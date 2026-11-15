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

describe("analyzeInstant for a real repository", () => {
  it("keeps only the GitHub numbers and leaves everything else empty", async () => {
    const report= await analyzeInstant("pallets/click");

    expect(report.source).toBe("git");
    expect(report.repository).toBe("pallets/click");
    expect(report.branch).toBe("main");
    expect(report.commit).toBeNull();
    expect(report.findings).toEqual([]);
    expect(report.summary.stride).toBeNull();
    expect(report.summary.privacy).toBeNull();
    expect(report.summary.git).toEqual({ prMergeHours: 17.5, commitsPerMonth: 31, codeOwnersCoverage: null });
    expect(report.activity?.mergeSampleSize).toBe(43);
  });

  it("never carries mock values into a real report", async () => {
    const text= JSON.stringify(await analyzeInstant("pallets/click"));

    expect(text).not.toContain("a3f89c1");
    expect(text).not.toContain("92");
    expect(text).not.toContain("Spoofing");
  });
});

describe("analyzeInstant for the demo", () => {
  it("still returns the full mock without calling GitHub", async () => {
    vi.useFakeTimers();
    const pending= analyzeInstant("deti-org/payment-service");
    await vi.advanceTimersByTimeAsync(1500);
    const report= await pending;
    vi.useRealTimers();

    expect(report.source).toBe("demo");
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.summary.git.codeOwnersCoverage).toBe(92);
    expect(getActivity).not.toHaveBeenCalled();
  });
});
