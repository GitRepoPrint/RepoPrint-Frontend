import { describe, expect, it } from "vitest";
import { CACHE_TTL_MS } from "./activity-cache";
import type { KeyValueStorage } from "./activity-cache";
import { fakeGithub } from "./fake-github";
import { getActivity } from "./get-activity";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data= new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function setup() {
  let time= Date.now();
  return {
    github: fakeGithub(),
    storage: memoryStorage(),
    clock: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("getActivity", () => {
  it("serves the second request inside the TTL from the cache", async () => {
    const { github, storage, clock }= setup();

    const first= await getActivity("o", "r", { fetcher: github.fetcher, storage, clock });
    const calls= github.calls.length;
    const second= await getActivity("o", "r", { fetcher: github.fetcher, storage, clock });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(github.calls).toHaveLength(calls);
    expect(second.fetchedAt).toBe(first.fetchedAt);
    expect(Date.parse(second.refreshAvailableAt) - Date.parse(second.fetchedAt)).toBe(CACHE_TTL_MS);
    expect(second.activity).toEqual(first.activity);
  });

  it("fetches again once the TTL has passed", async () => {
    const { github, storage, clock, advance }= setup();
    await getActivity("o", "r", { fetcher: github.fetcher, storage, clock });
    const calls= github.calls.length;

    advance(CACHE_TTL_MS);
    const again= await getActivity("o", "r", { fetcher: github.fetcher, storage, clock });

    expect(again.cached).toBe(false);
    expect(github.calls.length).toBeGreaterThan(calls);
  });

  it("does not cache errors", async () => {
    const { github, storage, clock }= setup();
    github.settings.missing= true;

    await expect(getActivity("o", "r", { fetcher: github.fetcher, storage, clock })).rejects.toThrow();
    github.settings.missing= false;
    const data= await getActivity("o", "r", { fetcher: github.fetcher, storage, clock });

    expect(data.cached).toBe(false);
  });

  it("ignores letter case in the repository name", async () => {
    const { github, storage, clock }= setup();

    await getActivity("Octo", "Repo", { fetcher: github.fetcher, storage, clock });
    const again= await getActivity("octo", "repo", { fetcher: github.fetcher, storage, clock });

    expect(again.cached).toBe(true);
  });

  it("ignores a corrupted entry", async () => {
    const { github, storage, clock }= setup();
    storage.data.set("repoprint:activity:o/r", "{not json");

    const data= await getActivity("o", "r", { fetcher: github.fetcher, storage, clock });

    expect(data.cached).toBe(false);
  });

  it("ignores an entry written by another version", async () => {
    const { github, storage, clock }= setup();
    storage.data.set("repoprint:activity:o/r", JSON.stringify({ version: 0, fetchedAt: clock(), activity: {} }));

    const data= await getActivity("o", "r", { fetcher: github.fetcher, storage, clock });

    expect(data.cached).toBe(false);
  });

  it("works without any storage", async () => {
    const { github, clock }= setup();

    const first= await getActivity("o", "r", { fetcher: github.fetcher, storage: null, clock });
    const second= await getActivity("o", "r", { fetcher: github.fetcher, storage: null, clock });

    expect([first.cached, second.cached]).toEqual([false, false]);
  });

  it("still answers when the storage refuses to save", async () => {
    const { github, clock }= setup();
    const storage: KeyValueStorage= {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => undefined,
    };

    const data= await getActivity("o", "r", { fetcher: github.fetcher, storage, clock });

    expect(data.cached).toBe(false);
  });
});
