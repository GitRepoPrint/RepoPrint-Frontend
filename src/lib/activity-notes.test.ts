import { describe, expect, it } from "vitest";
import { activityNotes, contributorsValue, mergeSampleText } from "./activity-notes";
import { formatClock } from "./format";
import type { ActivityInfo } from "@/lib/api/types";

const ACTIVITY: ActivityInfo= {
  fetchedAt: "2026-11-15T10:30:00Z",
  refreshAvailableAt: "2026-11-15T10:40:00Z",
  cached: false,
  activeContributors: 7,
  botsExcluded: 0,
  contributorsWindow: { complete: true, commitsRead: 140, since: "2026-08-17T10:00:00Z" },
  mergeSampleSize: 12,
};

describe("contributorsValue", () => {
  it("shows the plain number for a complete window", () => {
    expect(contributorsValue(ACTIVITY)).toBe("7");
  });

  it("shows At least N for a truncated window", () => {
    const partial= { ...ACTIVITY, contributorsWindow: { complete: false, commitsRead: 500, since: "2026-10-01T00:00:00Z" } };

    expect(contributorsValue(partial)).toBe("At least 7");
  });

  it("keeps zero as 0", () => {
    expect(contributorsValue({ ...ACTIVITY, activeContributors: 0 })).toBe("0");
  });
});

describe("mergeSampleText", () => {
  it.each([
    [0, "No merged PRs among the last 100 closed"],
    [1, "1 merged PR sampled"],
    [12, "12 merged PRs sampled"],
  ])("describes a sample of %i", (size, text) => {
    expect(mergeSampleText(size)).toBe(text);
  });
});

describe("formatClock", () => {
  it("shows the clock in a fixed time zone with its name", () => {
    expect(formatClock("2026-11-15T10:30:00Z", "UTC")).toBe("10:30 UTC");
  });
});

describe("activityNotes", () => {
  it("writes the data row in the requested time zone", () => {
    const data= activityNotes(ACTIVITY, 47, 4.2, "UTC").find((row) => row.metric === "Data");

    expect(data?.value).toBe("Read at 10:30 UTC");
  });

  it("marks a saved result and tells when fresh data is available", () => {
    const data= activityNotes({ ...ACTIVITY, cached: true }, 47, 4.2, "UTC").find((row) => row.metric === "Data");

    expect(data?.value).toBe("Saved at 10:30 UTC");
    expect(data?.rule).toContain("10:40 UTC");
  });

  it("shows N/A when there is no merge time", () => {
    const merge= activityNotes({ ...ACTIVITY, mergeSampleSize: 0 }, 47, null, "UTC").find((row) => row.metric === "Median PR merge time");

    expect(merge?.value).toBe("N/A");
  });
});
