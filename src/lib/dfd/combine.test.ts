import { describe, expect, it } from "vitest";
import votingDetail from "./__fixtures__/voting-detail.json";
import votingFiles from "./__fixtures__/voting-files.json";
import { combineGraphs } from "./combine";
import { buildOverview } from "./overview";
import { selectConfigFiles } from "./overview/select";
import { detailView, overviewView, project } from "./project";
import { isDfdGraph } from "./schema";
import type { Confidence, DfdGraph, GraphEdge, GraphNode } from "./schema";

const prov = (source: "config" | "code", confidence: Confidence, note: string) => ({ source, confidence, evidence: [{ note }] });

const proc = (path: string, source: "config" | "code" = "code", extra: Record<string, unknown> = {}): GraphNode => ({
  id: `process:${path}`, kind: "process", name: path.split("/").pop()!, path, provenance: prov(source, source === "config" ? "high" : "medium", `${source} ${path}`), extra,
});
const store = (id: string, technology: string, source: "config" | "code", tags: string[] = []): GraphNode => ({
  id: `data_store:${id}`, kind: "data_store", name: id, technology, tags, provenance: prov(source, source === "config" ? "high" : "medium", `${source} ${id}`),
});
const edge = (source: string, target: string, label: string, from: "config" | "code", extra: GraphEdge["extra"] = undefined): GraphEdge => ({
  id: `${source}->${target}:${label}`, source, target, label, provenance: prov(from, from === "config" ? "high" : "medium", `${from} ${label}`), ...(extra ? { extra } : {}),
});
const graph = (level: "overview" | "detail", nodes: GraphNode[], edges: GraphEdge[], extra?: Record<string, unknown>): DfdGraph => ({
  schema_version: "1", repository: { owner: "o", repo: "r" }, level, nodes, edges,
  meta: { producer: level === "overview" ? "browser-overview" : "backend-detail", generated_at: "2026-11-14T12:00:00Z", ...(level === "overview" ? { inputs: ["compose.yml"] } : {}) },
  ...(extra ? { extra } : {}),
});

const ids = (g: { nodes: { id: string }[] }) => g.nodes.map((n) => n.id);
const node = (g: DfdGraph, id: string) => g.nodes.find((n) => n.id === id)!;
const labelled = (g: { edges: GraphEdge[] }) => g.edges.map((e) => `${e.source} -> ${e.target} [${e.label}]`).sort();

describe("nodes with the same id", () => {
  const overview = graph("overview", [proc("api", "config", { image: "acme/api" }), store("db", "postgresql", "config")], []);
  const detail = graph("detail", [proc("api", "code", { files: ["api/main.py"], languages: { python: 1 } })], []);
  const combined = combineGraphs(overview, detail);

  it("are one node, with the stronger confidence and both sets of evidence", () => {
    expect(ids(combined).filter((i) => i === "process:api")).toHaveLength(1);
    const api = node(combined, "process:api");
    expect(api.provenance.confidence).toBe("high");
    expect(api.provenance.source).toBe("config");
    expect(api.provenance.evidence.map((e) => e.note)).toEqual(["config api", "code api"]);
  });

  it("keep what each side knows: the overview's image and the detail's files, and say where it came from", () => {
    expect(node(combined, "process:api").extra).toEqual({ image: "acme/api", files: ["api/main.py"], languages: { python: 1 }, sources: ["config", "code"] });
  });

  it("keep nodes that only one side has", () => {
    expect(ids(combined)).toContain("data_store:db");
    expect(node(combined, "data_store:db").extra?.sources).toBeUndefined();
  });

  it("are described as a combination", () => {
    expect(combined.level).toBe("detail");
    expect(combined.meta).toMatchObject({ producer: "combined", sources: ["browser-overview", "backend-detail"], inputs: ["compose.yml"] });
    expect(isDfdGraph(combined)).toBe(true);
  });
});

describe("a store found through an import and a store the compose file names", () => {
  const named = (graphs: { more?: GraphNode[] } = {}) => [store("db", "postgresql", "config"), ...(graphs.more ?? [])];
  const detailOf = (edges: GraphEdge[], extra?: Record<string, unknown>) => graph("detail", [proc("worker"), store("postgresql", "postgresql", "code")], edges, extra);

  it("are the same database when the compose file names exactly one of that technology", () => {
    const g = combineGraphs(graph("overview", named(), []), detailOf([]));
    expect(ids(g).filter((i) => i.startsWith("data_store:"))).toEqual(["data_store:db"]);
    expect(node(g, "data_store:db").provenance.evidence.map((e) => e.note)).toEqual(["config db", "code postgresql"]);
    expect(node(g, "data_store:db").extra?.sources).toEqual(["config", "code"]);
  });

  it("stay apart when there are several named ones, because it cannot tell which is meant", () => {
    const g = combineGraphs(graph("overview", named({ more: [store("replica", "postgresql", "config")] }), []), detailOf([]));
    expect(ids(g).filter((i) => i.startsWith("data_store:")).sort()).toEqual(["data_store:db", "data_store:postgresql", "data_store:replica"]);
  });

  it("never merge two stores the compose file names, even when one is called like its technology", () => {
    // dois Redis declarados: um chama-se "redis" (o id parece o de um nó anónimo) e o outro "cache"
    const named = (name: string): GraphNode => ({ ...store(name, "redis", "config"), extra: { composeService: name } });
    const g = combineGraphs(graph("overview", [named("redis"), named("cache")], []), graph("detail", [proc("app")], []));
    expect(ids(g).filter((i) => i.startsWith("data_store:")).sort()).toEqual(["data_store:cache", "data_store:redis"]);
  });

  it("do not merge across technologies", () => {
    const g = combineGraphs(graph("overview", [store("cache", "redis", "config")], []), detailOf([]));
    expect(ids(g).filter((i) => i.startsWith("data_store:")).sort()).toEqual(["data_store:cache", "data_store:postgresql"]);
  });

  it("send the edges that pointed at the vague node to the real one, and join duplicates", () => {
    const overview = graph("overview", [proc("worker", "config"), ...named()], [edge("process:worker", "data_store:db", "reads/writes", "config")]);
    const g = combineGraphs(overview, detailOf([edge("process:worker", "data_store:postgresql", "reads/writes", "code", { count: 3, via: ["psycopg2"] })]));
    expect(labelled(g)).toEqual(["process:worker -> data_store:db [reads/writes]"]);
    const merged = g.edges[0];
    expect(merged.provenance.evidence.map((e) => e.note)).toEqual(["config reads/writes", "code reads/writes"]);
    expect(merged.provenance.confidence).toBe("high");
    expect(merged.extra).toEqual({ count: 4, via: ["psycopg2"] });
  });

  it("send the detail's flows to the real node too", () => {
    const flow = { id: "f", route: "GET /x", process: "process:worker", resources: [{ id: "data_store:postgresql", kind: "datastore", path: ["process:worker", "data_store:postgresql"] }] };
    const g = combineGraphs(graph("overview", named(), []), detailOf([], { flows: [flow] }));
    expect((g.extra?.flows as typeof flow[])[0].resources[0]).toMatchObject({ id: "data_store:db", path: ["process:worker", "data_store:db"] });
  });

  it("leave the flows alone when nothing was merged", () => {
    const detail = detailOf([], { flows: [{ id: "f", resources: [] }] });
    expect(combineGraphs(graph("overview", [], []), detail).extra).toBe(detail.extra);
  });
});

describe("vague stores", () => {
  const detail = (...nodes: GraphNode[]) => graph("detail", [proc("app"), ...nodes], []);
  const generic = (id: string, technology: string, tags: string[] = []) => store(id, technology, "code", tags);

  it("'SQL database' (an ORM) becomes the one known SQL database", () => {
    const g = combineGraphs(graph("overview", [store("db", "postgresql", "config")], []), detail(generic("sql-database", "sql-database")));
    expect(ids(g).filter((i) => i.startsWith("data_store:"))).toEqual(["data_store:db"]);
  });

  it("'SQL database' stays when two SQL databases could be meant", () => {
    const g = combineGraphs(graph("overview", [store("a", "postgresql", "config"), store("b", "mysql", "config")], []), detail(generic("sql-database", "sql-database")));
    expect(ids(g).filter((i) => i.startsWith("data_store:")).sort()).toEqual(["data_store:a", "data_store:b", "data_store:sql-database"]);
  });

  it("'SQL database' is not a Redis", () => {
    const g = combineGraphs(graph("overview", [store("cache", "redis", "config")], []), detail(generic("sql-database", "sql-database")));
    expect(ids(g)).toContain("data_store:sql-database");
  });

  it("'Message queue' (celery) becomes the one known queue", () => {
    const g = combineGraphs(graph("overview", [store("broker", "rabbitmq", "config", ["queue"])], []), detail(generic("message-queue", "message-queue", ["queue"])));
    expect(ids(g).filter((i) => i.startsWith("data_store:"))).toEqual(["data_store:broker"]);
  });

  it("an anonymous store joins its instance first, and then the vague one finds a single candidate", () => {
    const g = combineGraphs(graph("overview", [store("db", "postgresql", "config")], []), detail(generic("postgresql", "postgresql"), generic("sql-database", "sql-database")));
    expect(ids(g).filter((i) => i.startsWith("data_store:"))).toEqual(["data_store:db"]);
  });
});

describe("parents", () => {
  const overview = graph("overview", [proc("services", "config"), proc("services/api", "config"), proc("web", "config")], []);
  const detail = graph("detail", [proc("services/api/users"), proc("services/api"), proc("services/billing"), proc("web/pages"), proc("scripts")], []);
  const combined = combineGraphs(overview, detail);
  const parent = (id: string) => node(combined, id).parent ?? null;

  it("makes the overview's components contain the detail's folders, by longest path prefix", () => {
    expect(parent("process:services/api/users")).toBe("process:services/api");
    expect(parent("process:services/billing")).toBe("process:services");
    expect(parent("process:web/pages")).toBe("process:web");
  });

  it("nests components in components", () => {
    expect(parent("process:services/api")).toBe("process:services");
  });

  it("leaves what no component claims without a parent, where it is still visible", () => {
    expect(parent("process:scripts")).toBeNull();
    expect(ids(overviewView(combined))).toEqual(expect.arrayContaining(["process:scripts", "process:services", "process:web"]));
  });

  it("keeps a component once, even when it was in both graphs", () => {
    expect(ids(combined).filter((i) => i === "process:services/api")).toHaveLength(1);
  });
});

describe("it is a function", () => {
  it("does not change the graphs it is given", () => {
    const overview = graph("overview", [proc("api", "config"), store("db", "postgresql", "config")], [edge("process:api", "data_store:db", "reads/writes", "config")]);
    const detail = graph("detail", [proc("api"), proc("api/x"), store("postgresql", "postgresql", "code")], [edge("process:api/x", "data_store:postgresql", "reads", "code")]);
    const before = JSON.stringify([overview, detail]);
    combineGraphs(overview, detail);
    expect(JSON.stringify([overview, detail])).toBe(before);
  });

  it("with an empty overview returns the detail graph's content", () => {
    const detail = graph("detail", [proc("a"), store("redis", "redis", "code")], [edge("process:a", "data_store:redis", "reads/writes", "code")]);
    const g = combineGraphs(graph("overview", [], []), detail);
    expect(ids(g)).toEqual(ids(detail));
    expect(g.edges).toEqual(detail.edges);
  });
});

describe("the combined views", () => {
  const overview = graph("overview", [proc("api", "config"), store("db", "postgresql", "config")], [edge("process:api", "data_store:db", "reads/writes", "config")]);
  const detail = graph("detail", [proc("api"), proc("api/models"), store("postgresql", "postgresql", "code")], [edge("process:api/models", "data_store:postgresql", "reads", "code", { via: ["psycopg2"] })]);
  const combined = combineGraphs(overview, detail);

  it("the overview shows one edge where the config says 'uses' and the code says 'reads': the precise one, with both proofs", () => {
    const view = overviewView(combined);
    expect(labelled(view)).toEqual(["process:api -> data_store:db [reads]"]);
    expect(view.edges[0].provenance.evidence.map((e) => e.note)).toEqual(["code reads", "config reads/writes"]);
  });

  it("the detail view shows both the component's edge and the folder's", () => {
    expect(labelled(detailView(combined))).toEqual(["process:api -> data_store:db [reads/writes]", "process:api/models -> data_store:db [reads]"]);
  });

  it("opening the component shows its folder", () => {
    expect(ids(project(combined, { expanded: new Set(["process:api"]) }))).toEqual(ids(detailView(combined)));
  });
});

describe("a real repository: dockersamples/example-voting-app", () => {
  // os ficheiros chegam pela ordem que o resto do programa lhes dá: o compose de base antes dos overrides
  const files = selectConfigFiles(Object.keys(votingFiles)).map((path) => ({ path, text: (votingFiles as Record<string, string>)[path] }));
  const overview = buildOverview({ owner: "dockersamples", repo: "example-voting-app", files, now: "2026-11-14T12:00:00Z" });
  const detail = votingDetail as unknown as DfdGraph;
  const combined = combineGraphs(overview, detail);

  it("starts from two valid graphs and ends with a valid one", () => {
    expect(isDfdGraph(overview)).toBe(true);
    expect(isDfdGraph(detail)).toBe(true);
    expect(isDfdGraph(combined)).toBe(true);
  });

  it("knows the PostgreSQL database once, under the name the compose file gives it", () => {
    expect(ids(combined)).toContain("data_store:db");
    expect(ids(combined)).not.toContain("data_store:postgresql");
    expect(ids(combined)).not.toContain("data_store:sql-database");
    const db = node(combined, "data_store:db");
    expect(db.provenance.confidence).toBe("high");
    expect(db.provenance.evidence.some((e) => e.file === "docker-compose.yml")).toBe(true);
    expect(db.provenance.evidence.some((e) => e.note?.startsWith("seen via"))).toBe(true);
  });

  it("puts every folder under the service that is built from it", () => {
    const parent = (id: string) => node(combined, id).parent ?? null;
    expect(parent("process:vote/templates")).toBe("process:vote");
    expect(parent("process:result/views")).toBe("process:result");
    expect(parent("process:result/tests")).toBe("process:result");
    expect(parent("process:healthchecks")).toBeNull();
  });

  it("the worker's database edge carries proof from the compose file and from the code", () => {
    const edge = combined.edges.find((e) => e.id === "process:worker->data_store:db:reads/writes")!;
    expect(edge.provenance.evidence.some((e) => e.file === "docker-compose.yml")).toBe(true);
    expect(edge.provenance.evidence.some((e) => e.note?.startsWith("seen via"))).toBe(true);
  });

  it("every edge and every flow step points at a node that exists", () => {
    const known = new Set(ids(combined));
    expect(combined.edges.every((e) => known.has(e.source) && known.has(e.target))).toBe(true);
    const flows = (combined.extra?.flows ?? []) as { process: string; resources: { id: string; path: string[] }[] }[];
    for (const flow of flows) {
      expect(known.has(flow.process)).toBe(true);
      for (const r of flow.resources) expect([r.id, ...r.path].every((id) => known.has(id))).toBe(true);
    }
  });

  it("the overview is the architecture: four services, the unclaimed folder, two databases, the client and the third-party hosts", () => {
    const view = overviewView(combined);
    expect(ids(view).filter((i) => i.startsWith("process:")).sort()).toEqual(["process:healthchecks", "process:result", "process:seed-data", "process:vote", "process:worker"]);
    expect(ids(view).filter((i) => i.startsWith("data_store:"))).toEqual(expect.arrayContaining(["data_store:db", "data_store:redis"]));
    expect(view.nodes.length).toBeLessThan(detailView(combined).nodes.length);
    expect(view.edges.some((e) => e.label === "imports")).toBe(false);
  });

  it("the overview lifts the code's edges to the services: a folder's call becomes its service's call", () => {
    const view = overviewView(combined);
    expect(view.edges.some((e) => e.source === "process:result" && e.target === "external_entity:socket.io" && e.label === "calls")).toBe(true);
    expect(view.edges.some((e) => e.source.includes("/"))).toBe(false);
  });

  it("the detail view loses nothing", () => {
    const view = detailView(combined);
    expect(view.nodes).toHaveLength(combined.nodes.length);
    expect(view.edges).toHaveLength(combined.edges.length);
  });
});
