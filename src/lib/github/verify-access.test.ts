import { describe, expect, it, vi } from "vitest";
import { verifyRepositoryAccess } from "./verify-access";

const answer= (status: number) => vi.fn(async () => new Response("{}", { status }));

describe("verifyRepositoryAccess", () => {
  it("asks the backend about the repository through the session proxy", async () => {
    const fetcher= answer(200);

    expect(await verifyRepositoryAccess("org/secret", fetcher)).toEqual({ ok: true });

    expect(fetcher).toHaveBeenCalledWith("/api/backend/github/activity?url=https%3A%2F%2Fgithub.com%2Forg%2Fsecret");
  });

  it.each([
    [404, "Repository not found, or your GitHub account has no access to it."],
    [409, "Your GitHub connection is no longer valid. Connect GitHub again from the profile menu."],
    [422, "This repository is empty."],
    [429, "GitHub rate limit reached. Try again in a while."],
    [401, "Your session expired. Sign in again."],
    [502, "GitHub did not respond. Please try again."],
    [503, "GitHub did not respond. Please try again."],
  ])("explains a %i answer", async (status, message) => {
    expect(await verifyRepositoryAccess("org/repo", answer(status))).toEqual({ ok: false, message });
  });

  it("treats a network failure like an unavailable GitHub", async () => {
    const down= vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    expect(await verifyRepositoryAccess("org/repo", down)).toEqual({ ok: false, message: "GitHub did not respond. Please try again." });
  });
});
