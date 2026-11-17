import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { analyzeRepository } from "./analyze";

const fakeOverview = (partial: boolean) => async () => ({ graph: {} as never, partial, fetchedAt: "x", refreshAvailableAt: "y", cached: false });

describe("analyzeRepository", () => {
  it("analyses the owner and repository it is given and says when it finished", async () => {
    const seen: string[] = [];
    const result = await analyzeRepository("pallets/flask", {
      getOverview: async (owner, repo) => { seen.push(`${owner}/${repo}`); return fakeOverview(false)(); },
      now: () => Date.parse("2026-11-14T12:00:00Z"),
    });
    expect(seen).toEqual(["pallets/flask"]);
    expect(result).toEqual({ analyzedAt: "2026-11-14T12:00:00.000Z", partial: false });
  });

  it("passes on that the result may be incomplete", async () => {
    expect((await analyzeRepository("a/b", { getOverview: fakeOverview(true) })).partial).toBe(true);
  });

  it("lets the error through, with its message for the user", async () => {
    const error = await analyzeRepository("a/b", { getOverview: async () => { throw new ApiError("Repository not found. It may not exist or may be private.", 404); } }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(/not found/);
  });
});
