import { describe, expect, it } from "vitest";
import { codeReadSummary } from "./code-read";

describe("codeReadSummary", () => {
  it("says how many source files were read when it was all of them", () => {
    expect(codeReadSummary({ files_parsed: 1046, files_found: 1046, sampled: false })).toBe("1,046 source files read");
    expect(codeReadSummary({ files_parsed: 1, files_found: 1 })).toBe("1 source file read");
  });

  it("says plainly when only a sample of a very large repository was read", () => {
    expect(codeReadSummary({ files_parsed: 2500, files_found: 75317, sampled: true })).toBe("a sample of 2,500 of 75,317 source files, because the repository is very large");
  });

  it("adds that the listing itself was incomplete", () => {
    expect(codeReadSummary({ files_parsed: 2500, files_found: 80000, sampled: true, listing_truncated: true })).toContain("some folders could not be listed");
  });

  it("copes with a backend that does not report how many files exist", () => {
    expect(codeReadSummary({ files_parsed: 12 })).toBe("12 source files read");
    expect(codeReadSummary(undefined)).toBe("0 source files read");
    expect(codeReadSummary({ files_parsed: 5, sampled: true })).toBe("5 source files read");
  });
});
