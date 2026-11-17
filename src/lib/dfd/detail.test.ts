import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { backendUrl } from "@/lib/config";
import votingDetail from "./__fixtures__/voting-detail.json";
import { DETAIL_TTL_MS, clearDetailCache, getDetail, peekDetail } from "./detail-cache";
import { fetchDetailGraph } from "./detail";

const BASE = "https://api.repoprint.test";
const respond = (status: number, body?: unknown) => async () => new Response(body === undefined ? null : JSON.stringify(body), { status });

describe("backendUrl", () => {
  it("cleans the setting and treats nothing as not configured", () => {
    expect(backendUrl("http://localhost:8000/")).toBe("http://localhost:8000");
    expect(backendUrl(" https://api.x.test/// ")).toBe("https://api.x.test");
    expect(backendUrl("")).toBeNull();
    expect(backendUrl("   ")).toBeNull();
    expect(backendUrl(undefined)).toBeNull();
  });
});

describe("fetchDetailGraph", () => {
  it("asks the backend for the repository by its GitHub address, grouped by folder", async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return Response.json(votingDetail);
    };
    const graph = await fetchDetailGraph("dockersamples", "example-voting-app", { backendUrl: BASE, fetcher });
    expect(seen[0].url).toBe(`${BASE}/dfd?url=https%3A%2F%2Fgithub.com%2Fdockersamples%2Fexample-voting-app&group_by=directory`);
    expect(seen[0].init?.headers).toEqual({ Accept: "application/json" }); // só o cabeçalho que não pede verificação prévia
    expect(graph.level).toBe("detail");
    expect(graph.nodes.length).toBeGreaterThan(5);
  });

  it("can group by file", async () => {
    let url = "";
    await fetchDetailGraph("o", "r", { backendUrl: BASE, groupBy: "file", fetcher: async (u) => { url = u; return Response.json(votingDetail); } });
    expect(url).toContain("group_by=file");
  });

  it.each([
    [400, /public GitHub repository address/], [404, /could not find this repository/], [413, /too large/], [429, /rate-limited/], [503, /busy/], [500, /failed/], [502, /failed/],
  ])("turns a %i into a message for the user, whatever language the backend used", async (status, message) => {
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: respond(status, { detail: "Repositório não encontrado ou privado" }) }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(message);
    expect(error.message).not.toMatch(/Reposit[óo]rio|Falha/);
  });

  it("keeps 429 and 503 as they are, so the page can tell 'try later' from 'broken'", async () => {
    for (const status of [429, 503]) {
      const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: respond(status) }).catch((e) => e);
      expect(error.status).toBe(status);
    }
    const broken = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: respond(500) }).catch((e) => e);
    expect(broken.status).toBe(502);
  });

  it("says the service cannot be reached when the network or CORS stops the request", async () => {
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: async () => { throw new TypeError("Failed to fetch"); } }).catch((e) => e);
    expect(error).toMatchObject({ status: 503, message: expect.stringMatching(/could not be reached/) });
  });

  it("says it took too long when the request times out", async () => {
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, timeoutMs: 20, fetcher: (_url, init) => new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))) }).catch((e) => e);
    expect(error).toMatchObject({ status: 503, message: expect.stringMatching(/took too long/) });
  });

  it("does not trust a response that is not a detail graph", async () => {
    for (const body of [{ nodes: "x" }, "text", null, { ...votingDetail, level: "overview" }, { ...votingDetail, edges: [{ id: "e", source: "nope", target: "nada", label: "x" }] }]) {
      const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: respond(200, body) }).catch((e) => e);
      expect(error).toMatchObject({ status: 502, message: expect.stringMatching(/unexpected/) });
    }
  });

  it("copes with a response that is not JSON at all", async () => {
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: async () => new Response("<html>", { status: 200 }) }).catch((e) => e);
    expect(error).toMatchObject({ status: 502 });
  });
});

describe("getDetail", () => {
  afterEach(() => clearDetailCache());
  const counting = () => {
    let calls = 0;
    return { fetcher: async () => { calls++; return Response.json(votingDetail); }, calls: () => calls };
  };

  it("keeps the graph for a while, whatever the case of the name, so coming back does not ask again", async () => {
    const f = counting();
    await getDetail("Acme", "Shop", { backendUrl: BASE, fetcher: f.fetcher, clock: () => 0 });
    expect(peekDetail("acme", "shop", 1)).not.toBeNull();
    await getDetail("acme", "SHOP", { backendUrl: BASE, fetcher: f.fetcher, clock: () => 1 });
    expect(f.calls()).toBe(1);
  });

  it("asks again after the time is up", async () => {
    const f = counting();
    await getDetail("a", "b", { backendUrl: BASE, fetcher: f.fetcher, clock: () => 0 });
    expect(peekDetail("a", "b", DETAIL_TTL_MS - 1)).not.toBeNull();
    expect(peekDetail("a", "b", DETAIL_TTL_MS)).toBeNull();
    await getDetail("a", "b", { backendUrl: BASE, fetcher: f.fetcher, clock: () => DETAIL_TTL_MS });
    expect(f.calls()).toBe(2);
  });

  it("does not keep a failure", async () => {
    await getDetail("a", "b", { backendUrl: BASE, fetcher: respond(500) }).catch(() => undefined);
    expect(peekDetail("a", "b")).toBeNull();
  });
});
