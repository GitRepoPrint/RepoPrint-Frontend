import { describe, expect, it } from "vitest";
import { STAGES, describeProgress, overallFraction, rising } from "./progress";
import type { LoadProgress } from "./progress";

const at = (stage: LoadProgress["stage"], done = 0, total = 0): LoadProgress => ({ stage, done, total });

describe("overallFraction", () => {
  it("starts at nothing and ends at everything", () => {
    expect(overallFraction(at("listing"))).toBe(0);
    expect(overallFraction(at("building"))).toBeGreaterThan(0.9);
    expect(overallFraction(at("building"))).toBeLessThan(1);
  });

  it("moves forward inside a phase as files are done", () => {
    const quarter = overallFraction(at("downloading", 250, 1000))!;
    const half = overallFraction(at("downloading", 500, 1000))!;
    const all = overallFraction(at("downloading", 1000, 1000))!;
    expect(quarter).toBeLessThan(half);
    expect(half).toBeLessThan(all);
  });

  it("never goes backwards from one phase to the next", () => {
    const sequence = [
      at("listing"), at("downloading", 0, 800), at("downloading", 400, 800), at("downloading", 800, 800),
      at("parsing", 0, 800), at("parsing", 400, 800), at("parsing", 800, 800), at("building"),
    ];
    const values = sequence.map((p) => overallFraction(p)!);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("when a phase does not know how much is left, it counts as the start of that phase", () => {
    expect(overallFraction(at("downloading", 0, 0))).toBe(overallFraction(at("downloading", 0, 500)));
    expect(overallFraction(at("downloading", 12, 0))).toBe(overallFraction(at("downloading", 0, 0)));
  });

  it("copes with a count that overshoots or is negative", () => {
    expect(overallFraction(at("parsing", 900, 800))).toBe(overallFraction(at("parsing", 800, 800)));
    expect(overallFraction(at("parsing", -5, 800))).toBe(overallFraction(at("parsing", 0, 800)));
  });

  it("is always between 0 and 1", () => {
    for (const stage of STAGES) for (const [done, total] of [[0, 0], [1, 2], [5, 5], [9, 3]]) {
      const v = overallFraction(at(stage, done, total))!;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("rising", () => {
  it("keeps the larger of two values so a progress ring never turns back", () => {
    expect(rising(0.4, 0.3)).toBe(0.4);
    expect(rising(0.4, 0.5)).toBe(0.5);
    expect(rising(undefined, 0.2)).toBe(0.2);
  });
});

describe("describeProgress", () => {
  it("says what is happening and, when it knows, how far along", () => {
    expect(describeProgress(at("listing"))).toBe("Listing the files");
    expect(describeProgress(at("downloading", 1200, 2500))).toBe("Downloading the code · 1,200 of 2,500 files");
    expect(describeProgress(at("parsing", 3, 3))).toBe("Analysing the code · 3 of 3 files");
    expect(describeProgress(at("building"))).toBe("Building the diagram");
  });

  it("does not show a count it does not have", () => {
    expect(describeProgress(at("downloading", 0, 0))).toBe("Downloading the code");
  });
});

describe("STAGES", () => {
  it("are the four phases of the backend, in order", () => {
    expect([...STAGES]).toEqual(["listing", "downloading", "parsing", "building"]);
  });
});
