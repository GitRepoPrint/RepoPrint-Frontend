import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { KeyValueStorage } from "@/lib/github/activity-cache";
import { OVERVIEW_TTL_MS, readOverviewCache } from "./cache";
import { getOverview } from "./get-overview";

const COMPOSE = "services:\n  api:\n    build: ./api\n  db:\n    image: postgres:16\n";

function fakeGithub(options: { failRaw?: boolean; status?: number } = {}) {
  const urls: string[] = [];
  const fetcher = async (input: string): Promise<Response> => {
    urls.push(input);
    if (options.status) return new Response(null, { status: options.status });
    if (input.startsWith("https://api.github.com/")) return Response.json({ tree: [{ path: "docker-compose.yml", type: "blob", size: 90 }] });
    return options.failRaw ? new Response(null, { status: 500 }) : new Response(COMPOSE);
  };
  return { fetcher, urls };
}

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
}

describe("getOverview", () => {
  it("fetches, builds the graph and remembers it", async () => {
    const { fetcher, urls } = fakeGithub();
    const storage = memoryStorage();
    const first = await getOverview("Acme", "Shop", { fetcher, storage, clock: () => 1000 });
    expect(first).toMatchObject({ cached: false, partial: false, fetchedAt: new Date(1000).toISOString() });
    expect(first.graph.nodes.map((n) => n.id)).toEqual(["process:api", "data_store:db"]);
    expect(first.refreshAvailableAt).toBe(new Date(1000 + OVERVIEW_TTL_MS).toISOString());
    expect(urls).toHaveLength(2);

    const second = await getOverview("acme", "shop", { fetcher, storage, clock: () => 2000 });
    expect(second).toMatchObject({ cached: true, fetchedAt: new Date(1000).toISOString() });
    expect(second.graph).toEqual(first.graph);
    expect(urls).toHaveLength(2); // nenhum pedido novo, e o nome do repositório não distingue maiúsculas
  });

  it("fetches again once the cache is old enough", async () => {
    const { fetcher, urls } = fakeGithub();
    const storage = memoryStorage();
    await getOverview("a", "b", { fetcher, storage, clock: () => 0 });
    await getOverview("a", "b", { fetcher, storage, clock: () => OVERVIEW_TTL_MS - 1 });
    expect(urls).toHaveLength(2);
    const later = await getOverview("a", "b", { fetcher, storage, clock: () => OVERVIEW_TTL_MS });
    expect(later.cached).toBe(false);
    expect(urls).toHaveLength(4);
  });

  it("does not remember an incomplete result, so the next try can get what was missing", async () => {
    const storage = memoryStorage();
    const broken = await getOverview("a", "b", { fetcher: fakeGithub({ failRaw: true }).fetcher, storage, clock: () => 0 });
    expect(broken.partial).toBe(true);
    expect(storage.data).toEqual({});
    const fixed = await getOverview("a", "b", { fetcher: fakeGithub().fetcher, storage, clock: () => 1 });
    expect(fixed.partial).toBe(false);
  });

  it("throws the message to show when GitHub says no", async () => {
    await expect(getOverview("a", "b", { fetcher: fakeGithub({ status: 404 }).fetcher, storage: memoryStorage() })).rejects.toMatchObject({ status: 404 });
    await expect(getOverview("a", "b", { fetcher: fakeGithub({ status: 500 }).fetcher, storage: memoryStorage() })).rejects.toBeInstanceOf(ApiError);
  });

  it("works with no storage at all (private window, server)", async () => {
    const { fetcher, urls } = fakeGithub();
    await getOverview("a", "b", { fetcher, storage: null });
    await getOverview("a", "b", { fetcher, storage: null });
    expect(urls).toHaveLength(4);
  });
});

describe("the cache", () => {
  const storage = (value: unknown) => memoryStorage({ "repoprint:overview:a/b": typeof value === "string" ? value : JSON.stringify(value) });

  it("throws away something that is not valid JSON, an old version or a graph with the wrong shape", () => {
    for (const bad of ["{ nope", { version: 0, fetchedAt: 1, graph: {} }, { version: 1, fetchedAt: 1, graph: { nodes: "x" } }, { version: 1, graph: {} }]) {
      const s = storage(bad);
      expect(readOverviewCache(s, "a", "b", 2)).toBeNull();
    }
  });

  it("removes what it throws away, so it is not parsed again", () => {
    const s = storage({ version: 1, fetchedAt: 1, graph: { nodes: "x" } });
    readOverviewCache(s, "a", "b", 2);
    expect(s.data).toEqual({});
  });

  it("survives a storage that throws", () => {
    const hostile: KeyValueStorage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("denied"); } };
    expect(readOverviewCache(hostile, "a", "b", 1)).toBeNull();
  });
});
