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


describe("fetchDetailGraph with progress", () => {
  const encoder = new TextEncoder();
  const line = (event: unknown) => JSON.stringify(event) + "\n";
  const resultLine = line({ type: "result", graph: votingDetail });

  /** Uma resposta que chega aos bocados, como o backend a envia. */
  const streamOf = (chunks: string[], init: ResponseInit = {}) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      }),
      { status: 200, headers: { "Content-Type": "application/x-ndjson" }, ...init },
    );

  it("asks for the stream and reports every step, in order, before returning the graph", async () => {
    const seen: string[] = [];
    const steps: { stage: string; done: number; total: number }[] = [];
    const fetcher = async (url: string) => {
      seen.push(url);
      return streamOf([
        line({ type: "progress", stage: "listing", done: 0, total: 0 }),
        line({ type: "progress", stage: "downloading", done: 10, total: 40 }),
        line({ type: "progress", stage: "parsing", done: 40, total: 40 }),
        resultLine,
      ]);
    };
    const graph = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher, onProgress: (p) => steps.push(p) });
    expect(seen[0]).toBe(`${BASE}/dfd/stream?url=https%3A%2F%2Fgithub.com%2Fo%2Fr&group_by=directory`);
    expect(steps).toEqual([
      { stage: "listing", done: 0, total: 0 },
      { stage: "downloading", done: 10, total: 40 },
      { stage: "parsing", done: 40, total: 40 },
    ]);
    expect(graph.level).toBe("detail");
  });

  it("only asks for the header that needs no preflight request", async () => {
    let init: RequestInit | undefined;
    await fetchDetailGraph("o", "r", { backendUrl: BASE, onProgress: () => {}, fetcher: async (_u, i) => { init = i; return streamOf([resultLine]); } });
    expect(init?.headers).toEqual({ Accept: "application/x-ndjson" });
  });

  it("copes with events that arrive cut in the middle", async () => {
    const whole = line({ type: "progress", stage: "parsing", done: 5, total: 9 }) + resultLine;
    const chunks = [whole.slice(0, 7), whole.slice(7, 60), whole.slice(60, 61), whole.slice(61)];
    const steps: unknown[] = [];
    const graph = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: async () => streamOf(chunks), onProgress: (p) => steps.push(p) });
    expect(steps).toEqual([{ stage: "parsing", done: 5, total: 9 }]);
    expect(graph.nodes.length).toBeGreaterThan(5);
  });

  it("ignores blank lines, unknown events and progress it does not understand", async () => {
    const steps: unknown[] = [];
    const fetcher = async () => streamOf(["\n", line({ type: "hello" }), line({ type: "progress", stage: "teleporting", done: 1, total: 2 }), line({ type: "progress", stage: "parsing", done: "x", total: 2 }), line({ type: "progress", stage: "building", done: 0, total: 0 }), resultLine]);
    await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher, onProgress: (p) => steps.push(p) });
    expect(steps).toEqual([{ stage: "building", done: 0, total: 0 }]);
  });

  it.each([
    [404, /could not find this repository/],
    [429, /rate-limited/],
    [503, /busy/],
    [502, /failed/],
  ])("turns an error event with status %i into a plain message", async (status, message) => {
    const fetcher = async () => streamOf([line({ type: "progress", stage: "listing", done: 0, total: 0 }), line({ type: "error", status, detail: "texto em português" })]);
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher, onProgress: () => {} }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(message);
    expect(error.message).not.toContain("português");
  });

  it("turns a refusal before the stream starts into the same messages", async () => {
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, onProgress: () => {}, fetcher: respond(429, { detail: "x" }) }).catch((e) => e);
    expect(error.message).toMatch(/rate-limited/);
  });

  it("says so when the stream stops without an answer", async () => {
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, onProgress: () => {}, fetcher: async () => streamOf([line({ type: "progress", stage: "parsing", done: 1, total: 2 })]) }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(/interrupted/);
  });

  it("refuses a result that is not a code-level graph", async () => {
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, onProgress: () => {}, fetcher: async () => streamOf([line({ type: "result", graph: { nope: true } })]) }).catch((e) => e);
    expect(error.message).toMatch(/unexpected/);
  });

  it("gives up when nothing arrives for too long, even though the connection stays open", async () => {
    const silent = async (_url: string, init?: RequestInit) =>
      new Response(new ReadableStream({ start(controller) { init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError"))); } }), { status: 200 });
    const error = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: silent, onProgress: () => {}, idleTimeoutMs: 30 }).catch((e) => e);
    expect(error.message).toMatch(/took too long/);
  });

  it("a stream that keeps talking is not cut off by the idle limit", async () => {
    const slow = async () =>
      new Response(new ReadableStream({
        async start(controller) {
          for (let i = 1; i <= 4; i++) {
            await new Promise((r) => setTimeout(r, 20));
            controller.enqueue(encoder.encode(line({ type: "progress", stage: "parsing", done: i, total: 4 })));
          }
          controller.enqueue(encoder.encode(resultLine));
          controller.close();
        },
      }), { status: 200 });
    const graph = await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: slow, onProgress: () => {}, idleTimeoutMs: 60 });
    expect(graph.level).toBe("detail");
  });

  it("without a progress callback it keeps using the plain endpoint", async () => {
    let url = "";
    await fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: async (u) => { url = u; return Response.json(votingDetail); } });
    expect(url).toContain("/dfd?");
    expect(url).not.toContain("/stream");
  });
});
