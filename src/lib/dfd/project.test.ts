import { describe, expect, it } from "vitest";
import flask from "./__fixtures__/flask-detail.json";
import { assignParents, detailView, overviewView, project } from "./project";
import { isDfdGraph } from "./schema";
import type { Confidence, DfdGraph, GraphEdge, GraphNode } from "./schema";

const provenance = (confidence: Confidence = "medium") => ({ source: "code" as const, confidence, evidence: [{ note: "test" }] });

const proc = (path: string, parent?: string): GraphNode => ({
  id: `process:${path}`, kind: "process", name: path, path, parent: parent ? `process:${parent}` : null, provenance: provenance("high"),
});
const store = (technology: string): GraphNode => ({
  id: `data_store:${technology}`, kind: "data_store", name: technology, technology, provenance: provenance(),
});
const entity = (id: string, tags: string[] = []): GraphNode => ({
  id: `external_entity:${id}`, kind: "external_entity", name: id, tags, provenance: provenance(),
});
const edge = (source: string, target: string, label: string, extra: Partial<GraphEdge> = {}): GraphEdge => ({
  id: `${source}->${target}:${label}`, source, target, label, provenance: provenance(), ...extra,
});

const graphOf = (nodes: GraphNode[], edges: GraphEdge[]): DfdGraph => ({
  schema_version: "1",
  repository: { owner: "o", repo: "r" },
  level: "detail",
  nodes,
  edges,
  meta: { producer: "backend-detail", generated_at: "2026-11-14T12:00:00Z" },
});

// api (routes, models) e web são componentes; routes e models são filhos de api
const SHOP = graphOf(
  [
    proc("api"), proc("api/routes", "api"), proc("api/models", "api"), proc("web"),
    store("postgresql"), entity("client", ["client"]), entity("api.stripe.com"),
  ],
  [
    edge("external_entity:client", "process:api/routes", "HTTP requests"),
    edge("process:api/routes", "process:api/models", "imports"),
    edge("process:api/routes", "data_store:postgresql", "reads", { operations: ["read"] }),
    edge("process:api/models", "data_store:postgresql", "writes", { operations: ["write"] }),
    edge("process:api/models", "data_store:postgresql", "reads", { operations: ["read"], extra: { count: 2, via: ["psycopg2"] }, provenance: provenance("high") }),
    edge("process:web", "process:api/routes", "imports"),
    edge("process:api/models", "external_entity:api.stripe.com", "calls"),
  ],
);

const ids = (items: { id: string }[]) => items.map((i) => i.id);
const labelled = (g: { edges: GraphEdge[] }) => g.edges.map((e) => `${e.source} -> ${e.target} [${e.label}]`).sort();

describe("overview", () => {
  const view = overviewView(SHOP);

  it("shows only the nodes that have no parent", () => {
    expect(ids(view.nodes)).toEqual(["process:api", "process:web", "data_store:postgresql", "external_entity:client", "external_entity:api.stripe.com"]);
  });

  it("lifts edges to the component, drops self-loops and lifted code imports, and merges parallel edges", () => {
    expect(view.edges.map((e) => [e.source, e.target, e.label])).toEqual([
      ["external_entity:client", "process:api", "HTTP requests"],
      ["process:api", "data_store:postgresql", "reads"],
      ["process:api", "data_store:postgresql", "writes"],
      ["process:api", "external_entity:api.stripe.com", "calls"],
    ]);
  });

  it("adds up the merged edges: count, operations, strongest confidence", () => {
    const reads = view.edges.find((e) => e.label === "reads")!;
    expect(reads.id).toBe("process:api->data_store:postgresql:reads");
    expect(reads.extra).toEqual({ count: 3, via: ["psycopg2"] });
    expect(reads.operations).toEqual(["read"]);
    expect(reads.provenance.confidence).toBe("high");
  });

  it("tells the interface what each component would reveal", () => {
    expect(view.children).toEqual({ "process:api": ["process:api/routes", "process:api/models"] });
  });

  it("does not change the graph it is given", () => {
    const before = JSON.stringify(SHOP);
    overviewView(SHOP);
    project(SHOP, { expanded: "all" });
    expect(JSON.stringify(SHOP)).toBe(before);
  });
});

describe("expanding", () => {
  it("shows the children of an expanded component, with their own edges untouched", () => {
    const view = project(SHOP, { expanded: new Set(["process:api"]) });
    expect(ids(view.nodes)).toContain("process:api/routes");
    expect(view.edges.find((e) => e.label === "imports" && e.source === "process:api/routes")).toBeDefined();
    expect(view.edges.find((e) => e.source === "external_entity:client")!.target).toBe("process:api/routes");
  });

  it("still lifts what is connected to a child that stays hidden", () => {
    const view = project(SHOP, { expanded: new Set(["process:api"]) });
    // web -> api/routes é visível dos dois lados, por isso o "imports" fica
    expect(view.edges.some((e) => e.source === "process:web" && e.target === "process:api/routes" && e.label === "imports")).toBe(true);
  });

  it("shows exactly the detail view's nodes once every component is open", () => {
    const opened = project(SHOP, { expanded: new Set(["process:api"]) });
    expect(new Set(ids(opened.nodes))).toEqual(new Set(ids(detailView(SHOP).nodes)));
  });

  it("ignores an expanded id that is not a component", () => {
    expect(ids(project(SHOP, { expanded: new Set(["data_store:postgresql", "nope"]) }).nodes)).toEqual(ids(overviewView(SHOP).nodes));
  });
});

describe("detail view", () => {
  it("returns every node and every edge exactly as given", () => {
    const view = detailView(SHOP);
    expect(view.nodes).toEqual(SHOP.nodes);
    expect(view.edges).toHaveLength(SHOP.edges.length);
    view.edges.forEach((e, i) => expect(e).toBe(SHOP.edges[i]));
  });
});

describe("without any grouping", () => {
  it("overview is the whole graph, nothing is lifted or dropped", () => {
    const flat = graphOf(SHOP.nodes.map((n) => ({ ...n, parent: null })), SHOP.edges);
    const view = overviewView(flat);
    expect(ids(view.nodes)).toEqual(ids(flat.nodes));
    expect(view.edges).toHaveLength(flat.edges.length);
    expect(view.children).toEqual({});
  });
});

describe("bad parents", () => {
  const bare = (id: string, parent: string | null): GraphNode => ({ ...proc(id), parent });

  it("a parent that does not exist is ignored: the node stays visible", () => {
    expect(ids(overviewView(graphOf([bare("a", "process:ghost")], [])).nodes)).toEqual(["process:a"]);
  });

  it("a parent that is not a process is ignored", () => {
    const view = overviewView(graphOf([store("redis"), bare("b", "data_store:redis")], []));
    expect(ids(view.nodes)).toEqual(["data_store:redis", "process:b"]);
  });

  it("any kind of node can sit inside a process", () => {
    const view = overviewView(graphOf([proc("a"), { ...store("redis"), parent: "process:a" }], []));
    expect(ids(view.nodes)).toEqual(["process:a"]);
    expect(view.children).toEqual({ "process:a": ["data_store:redis"] });
  });

  it("a cycle does not hang and still shows something", () => {
    const view = overviewView(graphOf([bare("a", "process:b"), bare("b", "process:a")], []));
    expect(view.nodes).toHaveLength(1);
  });

  it("a node cannot be its own parent", () => {
    expect(ids(overviewView(graphOf([bare("a", "process:a")], [])).nodes)).toEqual(["process:a"]);
  });
});

describe("assignParents", () => {
  const detail = graphOf([proc("services/api/users"), proc("services/apix"), proc("tools"), proc(".")], []);
  const components = [proc("services"), proc("services/api")];

  it("picks the longest path prefix, and only at a folder boundary", () => {
    const joined = assignParents(detail, components);
    const parent = (id: string) => joined.nodes.find((n) => n.id === id)!.parent;
    expect(parent("process:services/api/users")).toBe("process:services/api");
    expect(parent("process:services/apix")).toBe("process:services");
    expect(parent("process:tools")).toBeNull();
    expect(parent("process:.")).toBeNull();
  });

  it("nests components in each other", () => {
    const joined = assignParents(detail, components);
    expect(joined.nodes.find((n) => n.id === "process:services/api")!.parent).toBe("process:services");
    expect(joined.nodes.find((n) => n.id === "process:services")!.parent).toBeNull();
  });

  it("a root component claims everything that no folder component does", () => {
    const app: GraphNode = { ...proc("."), id: "process:application", name: "Application" };
    const joined = assignParents(detail, [app, ...components]);
    const parent = (id: string) => joined.nodes.find((n) => n.id === id)!.parent;
    expect(parent("process:tools")).toBe("process:application");
    expect(parent("process:.")).toBe("process:application");
    expect(parent("process:services/api/users")).toBe("process:services/api");
    expect(parent("process:services")).toBe("process:application");
  });

  it("a component with the same id as a detail node is that node: kept once, and still the parent of what is below it", () => {
    const withChild = graphOf([proc("tools"), proc("tools/x")], []);
    const joined = assignParents(withChild, [{ ...proc("tools"), name: "from overview" }]);
    expect(joined.nodes.filter((n) => n.id === "process:tools")).toHaveLength(1);
    expect(joined.nodes.find((n) => n.id === "process:tools")!.name).toBe("tools");
    expect(joined.nodes.find((n) => n.id === "process:tools/x")!.parent).toBe("process:tools");
    expect(joined.nodes.find((n) => n.id === "process:tools")!.parent).toBeNull();
  });

  it("nests detail folders in the detail folders that contain them, below any component", () => {
    const folders = graphOf([proc("a/b/c"), proc("a/b"), proc("a/x"), proc("z/y")], []);
    const joined = assignParents(folders, [proc("a")]);
    const parent = (id: string) => joined.nodes.find((n) => n.id === id)!.parent ?? null;
    expect(parent("process:a/b/c")).toBe("process:a/b");
    expect(parent("process:a/b")).toBe("process:a");
    expect(parent("process:a/x")).toBe("process:a");
    expect(parent("process:z/y")).toBeNull();
  });

  it("does not make the root folder the parent of every other folder", () => {
    const joined = assignParents(graphOf([proc("."), proc("lib")], []), []);
    expect(joined.nodes.every((n) => !n.parent)).toBe(true);
  });

  it("when a component and a detail folder share a path, the component is the parent of what is below", () => {
    const component = { ...proc("services/api"), id: "process:api-service" };
    const joined = assignParents(graphOf([proc("services/api"), proc("services/api/users")], []), [component]);
    expect(joined.nodes.find((n) => n.id === "process:services/api/users")!.parent).toBe("process:api-service");
    expect(joined.nodes.find((n) => n.id === "process:services/api")!.parent).toBe("process:api-service");
  });

  it("leaves non-process nodes and the input alone", () => {
    const withStore = graphOf([proc("tools"), store("redis")], []);
    const before = JSON.stringify(withStore);
    const joined = assignParents(withStore, [proc("tools")]);
    expect(joined.nodes.find((n) => n.id === "data_store:redis")!.parent).toBeUndefined();
    expect(JSON.stringify(withStore)).toBe(before);
  });
});

describe("real backend output (pallets/flask, group_by=directory)", () => {
  it("passes the runtime schema check", () => {
    expect(isDfdGraph(flask)).toBe(true);
  });

  const graph = flask as unknown as DfdGraph;
  const generic = new Set(["http-api", "websocket", "grpc", "auth-oauth-jwt", "file-storage"]);
  const isGeneric = (n: GraphNode) => generic.has(n.technology ?? "");
  const nonProcess = graph.nodes.filter((n) => n.kind !== "process");
  const named = nonProcess.filter((n) => !isGeneric(n));

  it("with no config found, the fallback 'Application' component collapses all code to one node", () => {
    const application: GraphNode = {
      id: "process:application", kind: "process", name: "Application", path: ".",
      provenance: { source: "config", confidence: "low", evidence: [{ note: "no config files found" }] },
    };
    const view = overviewView(assignParents(graph, [application]));
    expect(view.nodes).toHaveLength(1 + named.length);
    expect(ids(view.nodes).sort()).toEqual(["process:application", ...ids(named)].sort());
    // um cliente HTTP genérico não diz com quem se fala: fora do overview, mas continua no grafo
    expect(nonProcess.some(isGeneric)).toBe(true);
    expect(view.nodes.some(isGeneric)).toBe(false);
    expect(view.edges.length).toBeLessThan(graph.edges.length / 2);
    expect(view.edges.every((e) => e.label !== "imports")).toBe(true);
    const visible = new Set(ids(view.nodes));
    expect(view.edges.every((e) => visible.has(e.source) && visible.has(e.target))).toBe(true);
  });

  it("grouping by top-level folder keeps the folders no component claims", () => {
    const parts = ["src", "tests", "examples"].map((p) => proc(p));
    const overview = overviewView(assignParents(graph, parts));
    expect(ids(overview.nodes.filter((n) => n.kind === "process")).sort()).toEqual(
      ["process:.devcontainer", "process:examples", "process:src", "process:tests"],
    );
  });

  it("folders nest by path, so opening a component shows its first level and not every folder at once", () => {
    const joined = assignParents(graph, [proc("src")]);
    const parentOf = (id: string) => joined.nodes.find((n) => n.id === id)?.parent;
    expect(parentOf("process:src/flask")).toBe("process:src");
    expect(parentOf("process:src/flask/json")).toBe("process:src/flask");
    expect(parentOf("process:src/flask/sansio")).toBe("process:src/flask");
    const first = project(joined, { expanded: new Set(["process:src"]) });
    expect(ids(first.nodes)).toContain("process:src/flask");
    expect(ids(first.nodes)).not.toContain("process:src/flask/json");
    const second = project(joined, { expanded: new Set(["process:src", "process:src/flask"]) });
    expect(ids(second.nodes)).toContain("process:src/flask/json");
  });

  it("opening every component that has parts shows exactly what the detail view shows", () => {
    const joined = assignParents(graph, ["src", "tests", "examples"].map((p) => proc(p)));
    const open = project(joined, { expanded: new Set(Object.keys(project(joined).children)) });
    expect(new Set(ids(open.nodes))).toEqual(new Set(ids(detailView(joined).nodes)));
  });

  it("the fallback Application holds only the top-level folders until it is opened", () => {
    const application: GraphNode = { id: "process:application", kind: "process", name: "flask", path: ".", provenance: { source: "config", confidence: "low", evidence: [{ note: "x" }] } };
    const joined = assignParents(graph, [application]);
    const top = (joined.nodes.filter((n) => n.parent === "process:application")).length;
    const everything = joined.nodes.filter((n) => n.kind === "process" && n.id !== "process:application").length;
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(everything / 2);
  });

  it("the detail view loses nothing", () => {
    const view = detailView(graph);
    expect(view.nodes).toHaveLength(graph.nodes.length);
    expect(view.edges).toHaveLength(graph.edges.length);
  });
});

describe("a vague access label next to a precise one for the same pair", () => {
  const nodes = [proc("api"), proc("api/models", "api"), store("postgresql"), store("rabbitmq")];
  const withEdges = (edges: GraphEdge[]) => graphOf(nodes, edges);
  const noted = (label: string, note: string, source: "config" | "code" = "code"): GraphEdge["provenance"] => ({ source, confidence: "medium", evidence: [{ note: `${note} ${label}` }] });
  const view = (edges: GraphEdge[]) => overviewView(withEdges(edges)).edges;

  it("is folded into the precise one, which keeps both proofs", () => {
    const edges = view([
      edge("process:api", "data_store:postgresql", "reads/writes", { provenance: noted("reads/writes", "config", "config") }),
      edge("process:api/models", "data_store:postgresql", "reads", { provenance: noted("reads", "code") }),
    ]);
    expect(edges.map((e) => e.label)).toEqual(["reads"]);
    expect(edges[0].provenance.evidence.map((e) => e.note)).toEqual(["code reads", "config reads/writes"]);
  });

  it("is folded into every precise edge when there are several", () => {
    const edges = view([
      edge("process:api", "data_store:postgresql", "reads/writes"),
      edge("process:api/models", "data_store:postgresql", "reads"),
      edge("process:api/models", "data_store:postgresql", "writes"),
    ]);
    expect(edges.map((e) => e.label).sort()).toEqual(["reads", "writes"]);
  });

  it("stays when it is all there is", () => {
    expect(view([edge("process:api", "data_store:postgresql", "reads/writes")]).map((e) => e.label)).toEqual(["reads/writes"]);
  });

  it("does not fold across different pairs", () => {
    const other = graphOf([proc("api"), store("postgresql"), store("redis")], [
      edge("process:api", "data_store:postgresql", "reads/writes"), edge("process:api", "data_store:redis", "reads"),
    ]);
    expect(overviewView(other).edges.map((e) => e.label).sort()).toEqual(["reads", "reads/writes"]);
  });

  it("does not fold a label that means something else: 'calls' next to 'reads'", () => {
    expect(view([edge("process:api", "data_store:postgresql", "calls"), edge("process:api", "data_store:postgresql", "reads")]).map((e) => e.label).sort()).toEqual(["calls", "reads"]);
  });

  it("works for queues", () => {
    const edges = view([edge("process:api", "data_store:rabbitmq", "publishes/consumes"), edge("process:api/models", "data_store:rabbitmq", "publishes")]);
    expect(edges.map((e) => e.label)).toEqual(["publishes"]);
  });

  it("treats 'accesses' (no operation known) as vague too", () => {
    expect(view([edge("process:api", "data_store:postgresql", "accesses"), edge("process:api/models", "data_store:postgresql", "writes")]).map((e) => e.label)).toEqual(["writes"]);
  });

  it("does not change the edges it was given", () => {
    const edges = [edge("process:api", "data_store:postgresql", "reads/writes"), edge("process:api/models", "data_store:postgresql", "reads")];
    const g = withEdges(edges);
    const before = JSON.stringify(g);
    overviewView(g);
    expect(JSON.stringify(g)).toBe(before);
  });

  it("is not applied to the detail view, which shows every edge exactly as given", () => {
    const g = withEdges([edge("process:api", "data_store:postgresql", "reads/writes"), edge("process:api", "data_store:postgresql", "reads")]);
    expect(detailView(g).edges.map((e) => e.label).sort()).toEqual(["reads", "reads/writes"]);
    expect(overviewView(g).edges.map((e) => e.label)).toEqual(["reads"]);
  });

  it("can be switched off", () => {
    const g = withEdges([edge("process:api", "data_store:postgresql", "reads/writes"), edge("process:api", "data_store:postgresql", "reads")]);
    expect(project(g, { foldVagueLabels: false }).edges).toHaveLength(2);
  });
});

describe("'depends on', the weakest proof", () => {
  const procs = [proc("a"), proc("b"), proc("c")];
  const view = (edges: GraphEdge[]) => overviewView(graphOf(procs, edges));

  it("gives way to any other edge between the same two components, keeping its proof", () => {
    const edges = view([
      edge("process:a", "process:b", "depends on", { provenance: { source: "config", confidence: "medium", evidence: [{ note: "depends_on b" }] } }),
      edge("process:a", "process:b", "calls", { provenance: { source: "config", confidence: "high", evidence: [{ note: "URL points at b" }] } }),
    ]).edges;
    expect(edges.map((e) => e.label)).toEqual(["calls"]);
    expect(edges[0].provenance.evidence.map((e) => e.note)).toEqual(["URL points at b", "depends_on b"]);
  });

  it("stays when it is all there is", () => {
    expect(view([edge("process:a", "process:b", "depends on")]).edges.map((e) => e.label)).toEqual(["depends on"]);
  });

  it("is not folded into an edge of another pair", () => {
    expect(view([edge("process:a", "process:b", "depends on"), edge("process:a", "process:c", "calls")]).edges.map((e) => e.label).sort()).toEqual(["calls", "depends on"]);
  });

  it("is not folded into the opposite direction", () => {
    expect(view([edge("process:a", "process:b", "depends on"), edge("process:b", "process:a", "calls")]).edges.map((e) => e.label).sort()).toEqual(["calls", "depends on"]);
  });

  it("does not make two 'depends on' edges eat each other", () => {
    expect(view([edge("process:a", "process:b", "depends on")]).edges).toHaveLength(1);
  });
});

describe("generic clients in the overview", () => {
  const generic = (technology: string): GraphNode => ({
    id: `external_entity:${technology}`, kind: "external_entity", name: technology, technology, tags: ["third-party"], provenance: provenance("medium"),
  });
  const stripe: GraphNode = { ...generic("stripe"), id: "external_entity:stripe", technology: "stripe" };
  const g = graphOf(
    [proc("api"), proc("api/client", "api"), generic("http-api"), stripe],
    [edge("process:api/client", "external_entity:http-api", "calls"), edge("process:api/client", "external_entity:stripe", "calls")],
  );

  it("drops a lifted edge to a generic client, and the node with it, but keeps named services", () => {
    const view = overviewView(g);
    expect(ids(view.nodes)).toEqual(["process:api", "external_entity:stripe"]);
    expect(labelled(view)).toEqual(["process:api -> external_entity:stripe [calls]"]);
  });

  it("shows it again once the component that uses it is open", () => {
    const view = project(g, { expanded: new Set(["process:api"]) });
    expect(ids(view.nodes)).toContain("external_entity:http-api");
    expect(labelled(view)).toContain("process:api/client -> external_entity:http-api [calls]");
  });

  it("is always there in the detail view, and can be left on in the overview", () => {
    expect(ids(detailView(g).nodes)).toContain("external_entity:http-api");
    expect(ids(project(g, { hideGenericClients: false }).nodes)).toContain("external_entity:http-api");
  });

  it("stays hidden for a top-level component even when nothing was lifted: it only matters for the parts of an open one", () => {
    const flat = graphOf([proc("a"), generic("http-api")], [edge("process:a", "external_entity:http-api", "calls")]);
    expect(ids(overviewView(flat).nodes)).toEqual(["process:a"]);
    expect(overviewView(flat).edges).toEqual([]);
    expect(ids(detailView(flat).nodes)).toContain("external_entity:http-api");
  });

  it("is hidden for a part that is not showing, because its edge would be lifted", () => {
    const view = project(g, { expanded: new Set() });
    expect(ids(view.nodes)).not.toContain("external_entity:http-api");
  });
});
