import { beforeEach, describe, expect, it } from "vitest";
import { allow, resetRateLimits } from "./rate-limit";

beforeEach(resetRateLimits);

describe("allow", () => {
  it("blocks after the limit inside the window", () => {
    expect([1, 2, 3].map((n) => allow("ip", 2, 1000, n))).toEqual([true, true, false]);
  });

  it("allows again when old hits leave the window", () => {
    allow("ip", 1, 1000, 0);

    expect(allow("ip", 1, 1000, 500)).toBe(false);
    expect(allow("ip", 1, 1000, 1500)).toBe(true);
  });

  it("counts each key separately", () => {
    allow("a", 1, 1000, 0);

    expect(allow("b", 1, 1000, 0)).toBe(true);
  });
});
