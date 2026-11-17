import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { analyzeOverview } from "./index";
import { fetchOverviewFiles } from "./fetch";

type Entry = { path: string; size?: number; type?: string };

/** Um GitHub de brincar: a lista de ficheiros da API e o conteúdo em raw.githubusercontent.com. */
function fakeRepo(tree: Entry[], contents: Record<string, string>, options: { truncated?: boolean; treeStatus?: number; failRaw?: string[]; headers?: Record<string, string> } = {}) {
  const requests: { url: string; headers?: HeadersInit }[] = [];
  const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
    requests.push({ url: input, headers: init?.headers });
    if (input.startsWith("https://api.github.com/")) {
      if (options.treeStatus) return new Response(null, { status: options.treeStatus, headers: options.headers });
      return Response.json({ tree: tree.map((e) => ({ type: "blob", size: 100, ...e })), truncated: options.truncated ?? false });
    }
    const path = decodeURIComponent(input.replace("https://raw.githubusercontent.com/acme/shop/HEAD/", ""));
    if (options.failRaw?.includes(path)) return new Response(null, { status: 404 });
    return path in contents ? new Response(contents[path]) : new Response(null, { status: 404 });
  };
  return { fetcher, requests };
}

const COMPOSE = "services:\n  api:\n    build: ./api\n  db:\n    image: postgres:16\n    ports: ['5432:5432']\n";

describe("fetchOverviewFiles", () => {
  it("asks for the file list once and then only for the configuration files, no source code", async () => {
    const { fetcher, requests } = fakeRepo(
      [{ path: "docker-compose.yml" }, { path: "api/Dockerfile" }, { path: "api/main.py" }, { path: "node_modules/x/package.json" }, { path: "README.md" }],
      { "docker-compose.yml": COMPOSE, "api/Dockerfile": "FROM python:3.12\n" },
    );
    const { files, truncated, skipped } = await fetchOverviewFiles("acme", "shop", { fetcher });

    expect(requests.map((r) => r.url)).toEqual([
      "https://api.github.com/repos/acme/shop/git/trees/HEAD?recursive=1",
      "https://raw.githubusercontent.com/acme/shop/HEAD/docker-compose.yml",
      "https://raw.githubusercontent.com/acme/shop/HEAD/api/Dockerfile",
    ]);
    expect(files.map((f) => f.path)).toEqual(["docker-compose.yml", "api/Dockerfile"]);
    expect(files[0].text).toBe(COMPOSE);
    expect([truncated, skipped]).toEqual([false, []]);
  });

  it("sends no custom headers to raw.githubusercontent.com, so the browser needs no preflight request", async () => {
    const { fetcher, requests } = fakeRepo([{ path: "package.json" }], { "package.json": "{}" });
    await fetchOverviewFiles("acme", "shop", { fetcher });
    expect(requests[0].headers).toEqual({ Accept: "application/vnd.github+json" });
    expect(requests[1].headers).toBeUndefined();
  });

  it("skips files that are too big without downloading them", async () => {
    const { fetcher, requests } = fakeRepo([{ path: "package.json", size: 5_000_000 }, { path: "go.mod", size: 50 }], { "go.mod": "module x\n" });
    const { files } = await fetchOverviewFiles("acme", "shop", { fetcher });
    expect(files.map((f) => f.path)).toEqual(["go.mod"]);
    expect(requests.some((r) => r.url.endsWith("package.json"))).toBe(false);
  });

  it("reports what it could not download, and keeps going", async () => {
    const { fetcher } = fakeRepo([{ path: "docker-compose.yml" }, { path: "package.json" }], { "docker-compose.yml": COMPOSE, "package.json": "{}" }, { failRaw: ["package.json"] });
    const { files, skipped } = await fetchOverviewFiles("acme", "shop", { fetcher });
    expect(files.map((f) => f.path)).toEqual(["docker-compose.yml"]);
    expect(skipped).toEqual(["package.json"]);
  });

  it("survives a network error on one file", async () => {
    const real = fakeRepo([{ path: "docker-compose.yml" }, { path: "go.mod" }], { "docker-compose.yml": COMPOSE, "go.mod": "module x" });
    const fetcher = async (input: string, init?: RequestInit) => {
      if (input.endsWith("go.mod")) throw new TypeError("network down");
      return real.fetcher(input, init);
    };
    const { files, skipped } = await fetchOverviewFiles("acme", "shop", { fetcher });
    expect([files.length, skipped]).toEqual([1, ["go.mod"]]);
  });

  it("flags a file list that GitHub cut short", async () => {
    const { fetcher } = fakeRepo([{ path: "package.json" }], { "package.json": "{}" }, { truncated: true });
    expect((await fetchOverviewFiles("acme", "shop", { fetcher })).truncated).toBe(true);
  });

  it("encodes unusual characters in paths", async () => {
    const { fetcher, requests } = fakeRepo([{ path: "my app/Dockerfile" }], { "my app/Dockerfile": "FROM x" });
    await fetchOverviewFiles("acme", "shop", { fetcher });
    expect(requests[1].url).toBe("https://raw.githubusercontent.com/acme/shop/HEAD/my%20app/Dockerfile");
  });

  it("turns GitHub errors into messages for the user", async () => {
    const notFound = fakeRepo([], {}, { treeStatus: 404 });
    await expect(fetchOverviewFiles("acme", "shop", { fetcher: notFound.fetcher })).rejects.toMatchObject({ status: 404, message: expect.stringMatching(/not found/i) });

    const limited = fakeRepo([], {}, { treeStatus: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 600) } });
    await expect(fetchOverviewFiles("acme", "shop", { fetcher: limited.fetcher })).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/rate limit/i) });

    const empty = fakeRepo([], {}, { treeStatus: 409 });
    await expect(fetchOverviewFiles("acme", "shop", { fetcher: empty.fetcher })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("analyzeOverview", () => {
  it("fetches and builds, and says when the result may be incomplete", async () => {
    const { fetcher } = fakeRepo([{ path: "docker-compose.yml" }, { path: "api/package.json" }], { "docker-compose.yml": COMPOSE }, { failRaw: ["api/package.json"] });
    const { graph, partial } = await analyzeOverview("acme", "shop", { fetcher });
    expect(graph.nodes.map((n) => n.id)).toEqual(["process:api", "data_store:db"]);
    expect(partial).toBe(true);
  });

  it("is not partial when everything arrived", async () => {
    const { fetcher } = fakeRepo([{ path: "docker-compose.yml" }], { "docker-compose.yml": COMPOSE });
    expect((await analyzeOverview("acme", "shop", { fetcher })).partial).toBe(false);
  });
});
