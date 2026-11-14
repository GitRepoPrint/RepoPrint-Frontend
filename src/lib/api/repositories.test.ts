import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYZED_DESCRIPTION, PENDING_DESCRIPTION, isDemoRepository, loadRepositories, newRepository, parseGithubRepository, repoFromSlug, repoSlug, saveRepositories, stageOf, timeAgo } from "./repositories";
import type { Repository } from "./types";

const repo = (patch: Partial<Repository> = {}): Repository => ({ name: "o/r", description: "d", language: "—", score: null, updated: "Just added", ...patch });

describe("stageOf", () => {
  it("is 'pending' for a repository that was only added", () => {
    expect(stageOf(newRepository("pallets/flask"))).toBe("pending");
  });
  it("is 'analyzed' once the architecture was inferred, even without a score", () => {
    expect(stageOf(repo({ analyzedAt: "2026-11-14T12:00:00.000Z" }))).toBe("analyzed");
  });
  it("is 'scored' when there is a score, whatever else it has", () => {
    expect(stageOf(repo({ score: 84 }))).toBe("scored");
    expect(stageOf(repo({ score: 0 }))).toBe("scored"); // 0 é uma pontuação, não ausência dela
    expect(stageOf(repo({ score: 84, analyzedAt: "2026-11-14T12:00:00.000Z" }))).toBe("scored");
  });
});

describe("timeAgo", () => {
  const NOW = Date.parse("2026-11-14T12:00:00Z");
  const ago = (ms: number) => timeAgo(new Date(NOW - ms).toISOString(), NOW);
  const MIN = 60_000;

  it.each([
    [0, "Just now"], [59_000, "Just now"], [MIN, "1 min ago"], [59 * MIN, "59 min ago"], [60 * MIN, "1 hour ago"],
    [5 * 60 * MIN, "5 hours ago"], [24 * 60 * MIN, "1 day ago"], [3 * 24 * 60 * MIN, "3 days ago"],
  ])("%i ms ago -> %s", (ms, label) => expect(ago(ms)).toBe(label));

  it("gives the date once it is more than a month ago", () => {
    expect(ago(45 * 24 * 60 * MIN)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("does not show a negative age for a clock that is ahead", () => {
    expect(timeAgo(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe("Just now");
  });

  it("shows a dash for something that is not a date", () => {
    expect(timeAgo("yesterday-ish", NOW)).toBe("—");
    expect(timeAgo("", NOW)).toBe("—");
  });
});

describe("saved repositories", () => {
  const store = new Map<string, string>();
  const stub = () => vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  afterEach(() => { vi.unstubAllGlobals(); store.clear(); });

  it("still loads a repository saved before analysis existed (no analyzedAt), as pending", () => {
    stub();
    store.set("repoprint-repositories", JSON.stringify([{ name: "pallets/flask", description: "Newly associated repository · analysis pending", language: "—", score: null, updated: "Just added" }]));
    const [flask] = loadRepositories();
    expect(flask.name).toBe("pallets/flask");
    expect(stageOf(flask)).toBe("pending");
  });

  it("keeps the analysis date through a save and a load", () => {
    stub();
    saveRepositories([repo({ analyzedAt: "2026-11-14T12:00:00.000Z" })]);
    expect(loadRepositories()[0].analyzedAt).toBe("2026-11-14T12:00:00.000Z");
  });

  it("falls back to the demo list when what was saved is not valid, rather than breaking the page", () => {
    stub();
    store.set("repoprint-repositories", JSON.stringify([{ name: "x/y", description: "d", language: "—", score: null, updated: "u", analyzedAt: 42 }]));
    expect(loadRepositories().some((r) => r.name === "deti-org/payment-service")).toBe(true);
    store.set("repoprint-repositories", "{ not json");
    expect(loadRepositories().length).toBeGreaterThan(0);
  });
});

describe("descriptions", () => {
  it("a new repository says it is waiting, and the text after the analysis does not say so", () => {
    expect(newRepository("o/r").description).toBe(PENDING_DESCRIPTION);
    expect(PENDING_DESCRIPTION).toMatch(/pending/);
    expect(ANALYZED_DESCRIPTION).not.toMatch(/pending/i);
  });
});

describe("names", () => {
  it("recognises the demo repositories, whatever the case", () => {
    expect(isDemoRepository("deti-org/payment-service")).toBe(true);
    expect(isDemoRepository("DETI-ORG/Payment-Service")).toBe(true);
    expect(isDemoRepository("pallets/flask")).toBe(false);
  });
  it("parses GitHub addresses and round-trips slugs", () => {
    expect(parseGithubRepository("https://github.com/pallets/flask/tree/main")).toBe("pallets/flask");
    expect(parseGithubRepository("github.com/pallets/flask.git")).toBe("pallets/flask");
    expect(parseGithubRepository("https://example.com/pallets/flask")).toBeNull();
    expect(repoFromSlug(repoSlug("pallets/flask"))).toBe("pallets/flask");
  });
});
