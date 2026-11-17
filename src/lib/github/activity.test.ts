import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { fetchGithubActivity } from "./activity";
import { commit, fakeGithub, pull } from "./fake-github";

const HOUR= 60 * 60 * 1000;
const DAY= 24 * HOUR;
const NOW= Date.now();

const recentSample= () => [
  commit("alice", new Date(NOW - DAY)),
  commit("alice", new Date(NOW - 2 * DAY)),
  commit(null, new Date(NOW - 3 * DAY), { email: "bob@example.com" }),
  commit("carol", new Date(NOW - 4 * DAY)),
  commit("dependabot[bot]", new Date(NOW - 5 * DAY), { bot: true }),
];

describe("fetchGithubActivity", () => {
  it("takes the commit counts from the GitHub totals", async () => {
    const { fetcher }= fakeGithub({ sample: recentSample(), closed: [pull(2), pull(10), pull(4), pull(5, false)] });

    const data= await fetchGithubActivity("o", "r", { fetcher });

    expect(data).toMatchObject({
      totalCommits: 1200,
      commitsLast30d: 40,
      commitsLast90d: 300,
      commitsPerWeek90d: 23.3,
      openPrs: 3,
      openIssues: 7,
      defaultBranch: "main",
      stars: 7,
    });
  });

  it("leaves bots out of the active contributors", async () => {
    const { fetcher }= fakeGithub({ sample: recentSample() });

    const data= await fetchGithubActivity("o", "r", { fetcher });

    expect(data.activeContributors).toBe(3);
    expect(data.botsExcluded).toBe(1);
    expect(data.contributorsWindow).toMatchObject({ complete: true, commitsRead: 5 });
  });

  it("marks the window as incomplete when the sample hits the cap", async () => {
    const sample= Array.from({ length: 500 }, (_, i) => commit(`user${i % 7}`, new Date(NOW - i * HOUR)));
    const { fetcher }= fakeGithub({ sample });

    const data= await fetchGithubActivity("o", "r", { fetcher });

    expect(data.contributorsWindow).toEqual({
      complete: false,
      commitsRead: 500,
      since: new Date(NOW - 499 * HOUR).toISOString(),
    });
    expect(data.activeContributors).toBe(7);
  });

  it.each([
    [[2, 10, 4], 4],
    [[2, 4, 6, 8], 5],
    [[7], 7],
    [[1, 1, 500], 1],
  ])("uses the median of the merged pull requests %j", async (hours, expected) => {
    const { fetcher }= fakeGithub({ closed: [...hours.map((h) => pull(h)), pull(3, false)] });

    const data= await fetchGithubActivity("o", "r", { fetcher });

    expect(data.medianPrMergeHours).toBe(expected);
    expect(data.mergedPrsSampled).toBe(hours.length);
  });

  it("has no median without merged pull requests", async () => {
    const { fetcher }= fakeGithub({ closed: [pull(3, false)] });

    const data= await fetchGithubActivity("o", "r", { fetcher });

    expect(data.medianPrMergeHours).toBeNull();
    expect(data.mergedPrsSampled).toBe(0);
  });

  it("does not fail when the repository has pull requests disabled", async () => {
    const { fetcher }= fakeGithub({ pulls: false, openIssuesCount: 4 });

    const data= await fetchGithubActivity("o", "r", { fetcher });

    expect(data).toMatchObject({ openPrs: 0, medianPrMergeHours: null, openIssues: 4 });
  });

  it("only sends headers that need no CORS preflight", async () => {
    const { fetcher, calls }= fakeGithub({ sample: recentSample() });

    await fetchGithubActivity("o", "r", { fetcher });

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(Object.keys(call.headers)).toEqual(["Accept"]);
  });

  it("spends 7 requests on a small repository and 11 on a busy one", async () => {
    const small= fakeGithub({ sample: recentSample() });
    const busy= fakeGithub({ sample: Array.from({ length: 500 }, (_, i) => commit("a", new Date(NOW - i * HOUR))) });

    await fetchGithubActivity("o", "r", { fetcher: small.fetcher });
    await fetchGithubActivity("o", "r", { fetcher: busy.fetcher });

    expect(small.calls).toHaveLength(7);
    expect(busy.calls).toHaveLength(11);
  });

  it("goes straight to the new address of a renamed repository", async () => {
    const { fetcher, calls }= fakeGithub({ sample: recentSample(), renamed: true });

    const data= await fetchGithubActivity("old", "name", { fetcher });

    const afterFirstStep= calls.slice(2);
    expect(afterFirstStep).toHaveLength(5);
    for (const call of afterFirstStep) expect(call.url.pathname).toMatch(/^\/repositories\/123\//);
    expect(data.totalCommits).toBe(1200);
  });

  it("keeps using the repository name when there was no redirect", async () => {
    const { fetcher, calls }= fakeGithub({ sample: recentSample() });

    await fetchGithubActivity("o", "r", { fetcher });

    for (const call of calls.slice(2)) expect(call.url.pathname).toMatch(/^\/repos\/o\/r\//);
  });

  it("spends only 2 requests on a repository that does not exist", async () => {
    const { fetcher, calls }= fakeGithub({ missing: true });

    await expect(fetchGithubActivity("o", "r", { fetcher })).rejects.toMatchObject({ status: 404 });

    expect(calls).toHaveLength(2);
  });

  it("spends only 2 requests on an empty repository", async () => {
    const { fetcher, calls }= fakeGithub({ empty: true });

    await expect(fetchGithubActivity("o", "r", { fetcher })).rejects.toMatchObject({ status: 422 });

    expect(calls).toHaveLength(2);
  });
});

describe("errors", () => {
  it("turns an empty repository into a 422", async () => {
    const { fetcher }= fakeGithub({ empty: true });

    const failure= fetchGithubActivity("o", "r", { fetcher });

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 422, message: "This repository is empty." });
  });

  it("turns a missing repository into a 404", async () => {
    const { fetcher }= fakeGithub({ missing: true });

    await expect(fetchGithubActivity("o", "r", { fetcher })).rejects.toMatchObject({ status: 404 });
  });

  it("tells when the rate limit resets", async () => {
    const { fetcher }= fakeGithub({ limited: true });

    const failure= fetchGithubActivity("o", "r", { fetcher });

    await expect(failure).rejects.toMatchObject({ status: 429 });
    await expect(failure).rejects.toThrow(/rate limit reached for your network\. Try again at \d\d:\d\d\./);
  });

  it("treats a secondary limit with retry-after as a rate limit", async () => {
    const fetcher= async () => new Response(null, { status: 403, headers: { "retry-after": "60" } });

    await expect(fetchGithubActivity("o", "r", { fetcher })).rejects.toMatchObject({ status: 429 });
  });

  it("turns other GitHub failures into a 502", async () => {
    const fetcher= async () => new Response(null, { status: 500 });

    await expect(fetchGithubActivity("o", "r", { fetcher })).rejects.toMatchObject({ status: 502 });
  });

  it("lets network failures through", async () => {
    const fetcher= async (): Promise<Response> => {
      throw new TypeError("Failed to fetch");
    };

    await expect(fetchGithubActivity("o", "r", { fetcher })).rejects.toBeInstanceOf(TypeError);
  });
});
