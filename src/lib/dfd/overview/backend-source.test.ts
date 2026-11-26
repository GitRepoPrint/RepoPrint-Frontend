import { describe, expect, it } from "vitest";
import { analyzeOverview } from "./index";
import { backendSource } from "./backend-source";
import { getOverview } from "./get-overview";

const COMPOSE= "services:\n  api:\n    build: ./api\n  db:\n    image: postgres:16\n";
const BASE= "/api/backend";

type Source= { tree: { path: string; type: string; size: number }[]; truncated: boolean; files: Record<string, string> };

const SOURCE: Source= {
  tree: [{ path: "docker-compose.yml", type: "blob", size: 90 }, { path: "api/Dockerfile", type: "blob", size: 30 }],
  truncated: false,
  files: { "docker-compose.yml": COMPOSE, "api/Dockerfile": "FROM python:3.12\n" },
};

function fakeBackend(options: { status?: number; body?: unknown; source?: Source } = {}) {
  const seen: string[]= [];
  const fetcher= async (url: string): Promise<Response> => {
    seen.push(url);
    if (options.status) return new Response(options.body === undefined ? null : JSON.stringify(options.body), { status: options.status });
    return Response.json(options.source ?? SOURCE);
  };
  return { fetcher, seen };
}

describe("backendSource", () => {
  it("gets the tree and the config files in one request", async () => {
    const { fetcher, seen } = fakeBackend();
    const result = await analyzeOverview("acme", "shop", { backend: backendSource(BASE, fetcher) });
    expect(seen).toEqual([`${BASE}/dfd/source?url=${encodeURIComponent("https://github.com/acme/shop")}`]);
    expect(result.partial).toBe(false);
    expect(result.graph.nodes.length).toBeGreaterThan(1);
  });

  it("marks the result partial when the backend cut the list or a chosen file is missing", async () => {
    const cut = fakeBackend({ source: { ...SOURCE, truncated: true } });
    expect((await analyzeOverview("acme", "shop", { backend: backendSource(BASE, cut.fetcher) })).partial).toBe(true);
    const missing = fakeBackend({ source: { ...SOURCE, files: { "docker-compose.yml": COMPOSE } } });
    expect((await analyzeOverview("acme", "shop", { backend: backendSource(BASE, missing.fetcher) })).partial).toBe(true);
  });

  it("tells the user to install the app when the backend says so", async () => {
    const { fetcher } = fakeBackend({ status: 404, body: { detail: { code: "app_not_installed", message: "x" } } });
    await expect(analyzeOverview("acme", "shop", { backend: backendSource(BASE, fetcher) })).rejects.toMatchObject({
      message: expect.stringMatching(/Install the RepoPrint app/),
      status: 404,
    });
  });

  it.each([
    [404, { detail: "Repositório não encontrado" }, /Repository not found/],
    [413, undefined, /too large/],
    [429, undefined, /rate-limited/],
    [503, undefined, /busy/],
  ])("translates a %s from the backend", async (status, body, message) => {
    const { fetcher } = fakeBackend({ status, body });
    await expect(analyzeOverview("a", "b", { backend: backendSource(BASE, fetcher) })).rejects.toThrow(message);
  });

  it("never reaches GitHub directly when a backend is given", async () => {
    const { fetcher } = fakeBackend();
    const direct = async (): Promise<Response> => {
      throw new Error("direct call");
    };
    const data = await getOverview("acme", "shop", { backend: backendSource(BASE, fetcher), fetcher: direct, storage: null });
    expect(data.cached).toBe(false);
    expect(data.graph.nodes.length).toBeGreaterThan(1);
  });
});
