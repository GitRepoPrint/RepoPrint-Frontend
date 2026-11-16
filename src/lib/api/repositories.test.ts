import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { associateErrorMessage, associateRepository, formatAdded, listRepositories, parseGithubRepository, repoFromSlug, repoSlug } from "./repositories";

const row= { id: "r1", name: "Octo/Repo", url: "https://github.com/octo/repo", provider: "github", is_private: true, default_branch: "main", created_at: "2026-11-15T10:30:00Z" };

const answer= (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("listRepositories", () => {
  it("asks the backend through the session proxy and maps the rows", async () => {
    const fetcher= answer(200, [row]);

    const result= await listRepositories(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/backend/repositories", undefined);
    expect(result).toEqual([{ id: "r1", name: "Octo/Repo", isPrivate: true, defaultBranch: "main", addedAt: "2026-11-15T10:30:00Z" }]);
  });

  it("returns an empty list for a new user", async () => {
    expect(await listRepositories(answer(200, []))).toEqual([]);
  });

  it("accepts a repository without a default branch", async () => {
    const result= await listRepositories(answer(200, [{ ...row, default_branch: null }]));

    expect(result[0].defaultBranch).toBeNull();
  });

  it("rejects an answer with the wrong shape", async () => {
    await expect(listRepositories(answer(200, [{ id: "x" }]))).rejects.toThrow("Could not load your repositories");
    await expect(listRepositories(answer(200, { rows: [] }))).rejects.toBeInstanceOf(ApiError);
  });

  it.each([
    [401, "Your session expired. Sign in again."],
    [500, "Could not load your repositories. Please try again."],
    [503, "Could not load your repositories. Please try again."],
  ])("explains a %i answer", async (status, message) => {
    await expect(listRepositories(answer(status, { detail: "x" }))).rejects.toMatchObject({ message, status });
  });

  it("explains a network failure", async () => {
    const down= vi.fn(async () => { throw new TypeError("fetch failed"); });

    await expect(listRepositories(down)).rejects.toThrow("Could not reach RepoPrint");
  });
});

describe("associateRepository", () => {
  it("posts the GitHub URL and returns the saved repository", async () => {
    const fetcher= answer(201, row);

    const saved= await associateRepository("octo/repo", fetcher);

    const [path, init]= fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/backend/repositories");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://github.com/octo/repo" });
    expect(saved).toMatchObject({ id: "r1", name: "Octo/Repo", isPrivate: true });
  });

  it.each([
    [400, "Enter a valid GitHub repository URL."],
    [401, "Your session expired. Sign in again."],
    [404, "Repository not found, or your GitHub account has no access to it."],
    [429, "GitHub rate limit reached. Try again in a while."],
    [502, "GitHub did not respond. Please try again."],
    [503, "GitHub did not respond. Please try again."],
  ])("explains a %i answer", async (status, message) => {
    await expect(associateRepository("o/r", answer(status, { detail: "erro" }))).rejects.toMatchObject({ message, status });
  });

  it("tells a duplicate from a broken GitHub connection by the 409 detail", async () => {
    await expect(associateRepository("o/r", answer(409, { detail: "Este repositório já está associado" })))
      .rejects.toThrow("This repository is already associated.");
    await expect(associateRepository("o/r", answer(409, { detail: "A ligação ao GitHub deixou de ser válida. Liga a conta outra vez." })))
      .rejects.toThrow("Your GitHub connection is no longer valid. Connect GitHub again from the profile menu.");
  });

  it("copes with an error body that is not JSON", async () => {
    const broken= vi.fn(async () => new Response("<html>", { status: 409 }));

    await expect(associateRepository("o/r", broken)).rejects.toThrow("already associated");
  });

  it("rejects a success answer with the wrong shape", async () => {
    await expect(associateRepository("o/r", answer(201, { id: 1 }))).rejects.toBeInstanceOf(ApiError);
  });

  it("explains a network failure", async () => {
    const down= vi.fn(async () => { throw new TypeError("fetch failed"); });

    await expect(associateRepository("o/r", down)).rejects.toThrow("Could not reach RepoPrint");
  });
});

describe("associateErrorMessage", () => {
  it("falls back to the GitHub message for unknown statuses", () => {
    expect(associateErrorMessage(418)).toBe("GitHub did not respond. Please try again.");
  });
});

describe("formatAdded", () => {
  it("shows the day, short month and year in UTC", () => {
    expect(formatAdded("2026-11-15T23:30:00Z")).toBe("15 Nov 2026");
  });
});

describe("repository names", () => {
  it.each([
    ["https://github.com/Octo/Repo", "Octo/Repo"],
    ["github.com/octo/repo.git", "octo/repo"],
    ["  https://www.github.com/octo/repo/tree/main?tab=x ", "octo/repo"],
    ["https://gitlab.com/octo/repo", null],
    ["https://github.com/octo", null],
    ["https://github.com/a--b/repo", null],
  ])("parses %s", (input, expected) => {
    expect(parseGithubRepository(input)).toBe(expected);
  });

  it("round-trips a name through its slug", () => {
    expect(repoSlug("octo/repo")).toBe("octo--repo");
    expect(repoFromSlug("octo--repo")).toBe("octo/repo");
    expect(repoFromSlug("octo")).toBeNull();
  });
});
