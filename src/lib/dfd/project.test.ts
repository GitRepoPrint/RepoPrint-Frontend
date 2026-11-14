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
  const nonProcess = graph.nodes.filter((n) => n.kind !== "process");

  it("with no config found, the fallback 'Application' component collapses all code to one node", () => {
    const application: GraphNode = {
      id: "process:application", kind: "process", name: "Application", path: ".",
      provenance: { source: "config", confidence: "low", evidence: [{ note: "no config files found" }] },
    };
    const view = overviewView(assignParents(graph, [application]));
    expect(view.nodes).toHaveLength(1 + nonProcess.length);
    expect(ids(view.nodes).sort()).toEqual(["process:application", ...ids(nonProcess)].sort());
    expect(view.edges.length).toBeLessThan(graph.edges.length / 2);
    expect(view.edges.every((e) => e.label !== "imports")).toBe(true);
    const visible = new Set(ids(view.nodes));
    expect(view.edges.every((e) => visible.has(e.source) && visible.has(e.target))).toBe(true);
  });

  it("grouping by top-level folder keeps folders no component claims, and shows the same nodes as the detail view when opened", () => {
    const parts = ["src", "tests", "examples"].map((p) => proc(p));
    const joined = assignParents(graph, parts);
    const overview = overviewView(joined);
    expect(ids(overview.nodes.filter((n) => n.kind === "process")).sort()).toEqual(
      ["process:.devcontainer", "process:examples", "process:src", "process:tests"],
    );
    const open = project(joined, { expanded: new Set(parts.map((p) => p.id)) });
    expect(new Set(ids(open.nodes))).toEqual(new Set(ids(detailView(joined).nodes)));
  });

  it("the detail view loses nothing", () => {
    const view = detailView(graph);
    expect(view.nodes).toHaveLength(graph.nodes.length);
    expect(view.edges).toHaveLength(graph.edges.length);
  });
});
