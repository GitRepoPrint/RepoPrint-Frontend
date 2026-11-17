import { describe, expect, it } from "vitest";
import { ALL_KINDS, OVERVIEW_MAX_NODES, applyFocus, applyOverview, flowIds, isAuxiliary, listNodes, overviewIds, scoreNodes, withoutAuxiliary } from "./focus";
import { expandToDepth, project } from "./project";
import type { GraphView } from "./project";
import type { DfdGraph, GraphEdge, GraphNode, GraphNodeKind, Source } from "./schema";

const provenance = (source: Source = "code") => ({ source, confidence: "medium" as const, evidence: [{ note: "test" }] });

function node(id: string, kind: GraphNodeKind = "process", extra: Partial<GraphNode> = {}): GraphNode {
  const path = kind === "process" ? id.replace(/^process:/, "") : undefined;
  return { id, kind, name: path?.split("/").pop() ?? id, ...(path ? { path } : {}), provenance: provenance(), ...extra };
}

function edge(source: string, target: string, label = "imports"): GraphEdge {
  return { id: `${source}->${target}:${label}`, source, target, label, provenance: provenance() };
}

const view = (nodes: GraphNode[], edges: GraphEdge[]): GraphView => ({ nodes, edges, children: {} });
const graph = (nodes: GraphNode[], edges: GraphEdge[]): DfdGraph => ({
  schema_version: "1", repository: { owner: "o", repo: "r" }, level: "detail", nodes, edges, meta: { producer: "backend-detail", generated_at: "2026-01-01T00:00:00Z" },
});

const CLIENT = node("external_entity:client", "external_entity", { name: "User / Client", tags: ["client"] });
const DB = node("data_store:postgresql", "data_store", { name: "PostgreSQL", technology: "postgresql" });
const STRIPE = node("external_entity:stripe", "external_entity", { name: "api.stripe.com", tags: ["third-party"] });

/** Uma aplicação web: api (recebe pedidos) -> service -> repo (toca na base de dados), com utilitários, testes e documentação ao lado. */
function webApp(extraFolders = 12): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const filler = Array.from({ length: extraFolders }, (_, i) => node(`process:app/misc${i}`));
  const nodes = [
    CLIENT, DB, STRIPE,
    node("process:app/api"), node("process:app/service"), node("process:app/repo"), node("process:app/utils"), node("process:app/config"),
    node("process:tests"), node("process:docs_src/tutorial1"), node("external_entity:cdn.example-cdn.io", "external_entity", { name: "cdn.example-cdn.io", tags: ["third-party"] }),
    ...filler,
  ];
  const edges = [
    edge(CLIENT.id, "process:app/api", "HTTP requests"),
    edge("process:app/api", "process:app/service"),
    edge("process:app/service", "process:app/repo"),
    edge("process:app/repo", DB.id, "reads"),
    edge("process:app/service", STRIPE.id, "calls"),
    edge("process:app/service", "process:app/utils"),
    edge("process:app/api", "process:app/config"),
    edge("process:tests", "process:app/api"),
    edge("process:tests", "process:app/repo"),
    edge("process:docs_src/tutorial1", "external_entity:cdn.example-cdn.io", "calls"),
    edge(CLIENT.id, "process:docs_src/tutorial1", "HTTP requests"),
    ...filler.map((f) => edge(f.id, "process:app/utils")),
  ];
  return { nodes, edges };
}

describe("tests, docs and scripts", () => {
  it("are recognised by any part of the path", () => {
    for (const path of ["tests", "src/tests/unit", "docs_src/tutorial", "examples", "scripts", "pkg/test_telemetry", "app/e2e", "benchmarks"]) {
      expect(isAuxiliary(node(`process:${path}`)), path).toBe(true);
    }
    for (const path of ["fastapi", "src/app/users", "app/contests", "latest", "api"]) expect(isAuxiliary(node(`process:${path}`)), path).toBe(false);
    expect(isAuxiliary(node("data_store:tests", "data_store"))).toBe(false);
  });

  it("are taken out of the graph together with what only they used", () => {
    const { nodes, edges } = webApp();
    const shaped = withoutAuxiliary(graph(nodes, edges));
    const ids = new Set(shaped.nodes.map((n) => n.id));
    expect(ids.has("process:tests")).toBe(false);
    expect(ids.has("process:docs_src/tutorial1")).toBe(false);
    expect(ids.has("external_entity:cdn.example-cdn.io")).toBe(false); // só a documentação o usava
    expect(ids.has("process:app/api")).toBe(true);
    expect(ids.has(DB.id)).toBe(true); // o código do produto também o usa
    expect(shaped.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });

  it("drop a database that only a test opens, but not one nothing was ever connected to", () => {
    const orphan = node("data_store:redis", "data_store", { name: "Redis" });
    const lonely = node("data_store:minio", "data_store", { name: "MinIO" });
    const g = graph([node("process:app"), node("process:tests"), orphan, lonely], [edge("process:tests", orphan.id, "reads")]);
    const ids = withoutAuxiliary(g).nodes.map((n) => n.id);
    expect(ids).not.toContain("data_store:redis");
    expect(ids).toContain("data_store:minio");
  });

  it("never touch what came from configuration (a compose service called docs is a real service)", () => {
    const docs = node("process:docs", "process", { provenance: provenance("config") });
    const g = graph([docs, node("process:app")], [edge("process:app", "process:docs")]);
    expect(withoutAuxiliary(g)).toBe(g);
  });

  it("leave a repository that is only documentation with a diagram", () => {
    const g = graph([node("process:docs"), node("process:examples")], [edge("process:docs", "process:examples")]);
    expect(withoutAuxiliary(g)).toBe(g);
  });

  it("make the whole FastAPI-like diagram much shorter", () => {
    const tutorials = Array.from({ length: 100 }, (_, i) => node(`process:docs_src/tutorial${i}`));
    const g = graph([node("process:fastapi"), node("process:fastapi/openapi"), ...tutorials], tutorials.map((t) => edge(t.id, "process:fastapi")));
    expect(g.nodes).toHaveLength(102);
    expect(withoutAuxiliary(g).nodes).toHaveLength(2);
  });
});

describe("the levels of folders", () => {
  it("fold deeper folders into their parent, so the diagram is shorter and no flow is lost", () => {
    const nodes = [
      node("process:app"),
      node("process:app/a", "process", { parent: "process:app" }),
      node("process:app/a/deep", "process", { parent: "process:app/a" }),
      node("process:app/a/deep/deeper", "process", { parent: "process:app/a/deep" }),
      DB,
    ];
    const g = graph(nodes, [edge("process:app/a/deep/deeper", DB.id, "reads")]);
    const at = (levels: number) => project(g, { expanded: expandToDepth(g, levels) });
    // um componente aberto continua à vista, desenhado à volta das suas partes; o que está abaixo do limite fica fechado dentro do pai
    expect(at(1).nodes.map((n) => n.id).sort()).toEqual([DB.id, "process:app", "process:app/a"].sort());
    expect(at(2).nodes.map((n) => n.id).sort()).toEqual([DB.id, "process:app", "process:app/a", "process:app/a/deep"].sort());
    expect(project(g, { expanded: "all" }).nodes).toHaveLength(5);
    // a ligação à base de dados sobe para o componente visível
    expect(at(1).edges.map((e) => `${e.source}->${e.target}`)).toEqual([`process:app/a->${DB.id}`]);
  });
});

describe("the main flow (full view)", () => {
  it("is every component on a path from where requests come in to where data goes", () => {
    const { nodes, edges } = webApp();
    const ids = flowIds(view(nodes, edges));
    expect(ids).toEqual(expect.arrayContaining([CLIENT.id, "process:app/api", "process:app/service", "process:app/repo", DB.id, STRIPE.id]));
  });

  it("leaves out utilities and configuration that are not on any such path", () => {
    const { nodes, edges } = webApp();
    const ids = flowIds(view(nodes, edges));
    expect(ids).not.toContain("process:app/utils");
    expect(ids).not.toContain("process:app/config");
    expect(ids).not.toContain("process:app/misc0");
  });

  it("leaves out tests, documentation and what only they use", () => {
    const { nodes, edges } = webApp();
    const ids = flowIds(view(nodes, edges));
    expect(ids).not.toContain("process:tests");
    expect(ids).not.toContain("process:docs_src/tutorial1");
    expect(ids).not.toContain("external_entity:cdn.example-cdn.io");
  });

  it("has no limit: a long path is shown whole", () => {
    const chain = Array.from({ length: 25 }, (_, i) => node(`process:app/step${String(i).padStart(2, "0")}`));
    const edges = [
      edge(CLIENT.id, chain[0].id, "HTTP requests"),
      ...chain.slice(0, -1).map((c, i) => edge(c.id, chain[i + 1].id)),
      edge(chain[24].id, DB.id, "writes"),
    ];
    const ids = flowIds(view([CLIENT, DB, ...chain], edges));
    expect(ids).toHaveLength(27);
    expect(ids.length).toBeGreaterThan(OVERVIEW_MAX_NODES);
  });

  it("without entry points (a library) is the code that touches data", () => {
    const folders = Array.from({ length: 12 }, (_, i) => node(`process:lib/m${i}`));
    const edges = [edge("process:lib/m3", DB.id, "reads"), edge("process:lib/m7", STRIPE.id, "calls"), edge("process:lib/m1", "process:lib/m3")];
    const ids = flowIds(view([DB, STRIPE, ...folders], edges));
    expect(ids.sort()).toEqual([DB.id, STRIPE.id, "process:lib/m3", "process:lib/m7"].sort());
  });

  it("falls back to the busiest components when nothing touches data", () => {
    const folders = Array.from({ length: 30 }, (_, i) => node(`process:lib/m${String(i).padStart(2, "0")}`));
    const edges = folders.slice(0, -1).map((f, i) => edge(f.id, folders[i + 1].id));
    const ids = flowIds(view(folders, edges));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(10);
  });

  it("shows a diagram that is already small as a whole", () => {
    const small = view([CLIENT, node("process:app/a"), node("process:app/b"), node("process:app/c"), DB], [edge(CLIENT.id, "process:app/a", "HTTP requests"), edge("process:app/a", DB.id, "reads")]);
    expect(flowIds(small)).toHaveLength(5);
  });

  it("can be narrowed to some kinds of component", () => {
    const { nodes, edges } = webApp();
    const ids = flowIds(view(nodes, edges), { kinds: new Set<GraphNodeKind>(["data_store", "external_entity"]) });
    expect(ids.every((id) => id.startsWith("data_store:") || id.startsWith("external_entity:"))).toBe(true);
    expect(ids).toContain(DB.id);
  });

  it("always includes the selected component and the parts of an opened one", () => {
    const { nodes, edges } = webApp();
    const ids = flowIds(view(nodes, edges), { pinned: ["process:app/utils"], boost: new Set(["process:app/config"]) });
    expect(ids).toEqual(expect.arrayContaining(["process:app/utils", "process:app/config"]));
  });
});

describe("the overview (dashboard)", () => {
  it("never shows more than 10 components, however big the flow is", () => {
    const chain = Array.from({ length: 40 }, (_, i) => node(`process:app/step${String(i).padStart(2, "0")}`));
    const edges = [edge(CLIENT.id, chain[0].id, "HTTP requests"), ...chain.slice(0, -1).map((c, i) => edge(c.id, chain[i + 1].id)), edge(chain[39].id, DB.id, "writes")];
    const { view: shown, total, shown: count } = applyOverview(view([CLIENT, DB, ...chain], edges));
    expect(total).toBe(42);
    expect(shown.nodes).toHaveLength(OVERVIEW_MAX_NODES);
    expect(count).toBe(10);
    expect(OVERVIEW_MAX_NODES).toBe(10);
  });

  it("shows fewer when the main flow is smaller", () => {
    const { nodes, edges } = webApp();
    const result = applyOverview(view(nodes, edges));
    expect(result.shown).toBe(6);
    expect(result.shown).toBeLessThan(OVERVIEW_MAX_NODES);
  });

  it("keeps only the best-connected few of the outside sites that were merely mentioned in code", () => {
    const hosts = Array.from({ length: 8 }, (_, i) => node(`external_entity:site${i}.example-site.io`, "external_entity", { name: `site${i}.example-site.io`, tags: ["third-party"] }));
    const { nodes, edges } = webApp(0);
    const withHosts = view([...nodes, ...hosts], [...edges, ...hosts.map((h) => edge("process:app/service", h.id, "calls"))]);
    const ids = overviewIds(withHosts);
    // o Stripe (que aqui também não tem tecnologia conhecida) conta como mais um sítio: 9 candidatos, ficam 3
    expect(ids.filter((id) => id.startsWith("external_entity:") && id !== CLIENT.id)).toHaveLength(3);
    expect(ids).toEqual(expect.arrayContaining([CLIENT.id, DB.id, "process:app/api"]));
  });

  it("never drops a data store or a service with a known technology, only mentioned sites", () => {
    const known = node("external_entity:s3", "external_entity", { name: "AWS S3", technology: "aws-s3", tags: ["third-party"] });
    const hosts = Array.from({ length: 6 }, (_, i) => node(`external_entity:h${i}.example-site.io`, "external_entity", { name: `h${i}.example-site.io`, tags: ["third-party"] }));
    const { nodes, edges } = webApp(0);
    const ids = overviewIds(view([...nodes, known, ...hosts], [...edges, edge("process:app/repo", known.id, "writes"), ...hosts.map((h) => edge("process:app/service", h.id, "calls"))]));
    expect(ids).toContain("external_entity:s3");
  });

  it("keeps the picture connected and only the edges between what is shown", () => {
    const { nodes, edges } = webApp();
    const { view: shown } = applyOverview(view(nodes, edges), { max: 4 });
    const ids = new Set(shown.nodes.map((n) => n.id));
    expect(shown.nodes).toHaveLength(4);
    expect(shown.edges.length).toBeGreaterThan(0);
    expect(shown.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });

  it("gives the same answer every time", () => {
    const { nodes, edges } = webApp();
    expect(overviewIds(view(nodes, edges), { max: 4 })).toEqual(overviewIds(view(nodes, edges), { max: 4 }));
  });

  it("makes room for the parts of a component the user opened, still within the limit", () => {
    const { nodes, edges } = webApp();
    const ids = overviewIds(view(nodes, edges), { max: 5, boost: new Set(["process:app/config", "process:app/utils"]) });
    expect(ids).toHaveLength(5);
    expect(ids).toEqual(expect.arrayContaining(["process:app/utils", "process:app/config"]));
  });

  it("does not depend on which component is selected: the diagram stays the same", () => {
    const hosts = Array.from({ length: 8 }, (_, i) => node(`external_entity:site${i}.example-site.io`, "external_entity", { name: `site${i}.example-site.io`, tags: ["third-party"] }));
    const { nodes, edges } = webApp(0);
    const v = view([...nodes, ...hosts], [...edges, ...hosts.map((h) => edge("process:app/service", h.id, "calls"))]);
    // a prévia só depende do diagrama e do que o utilizador abriu: selecionar um componente (que já se vê) não lhe toca,
    // e por isso também não traz um sítio a mais
    const before = overviewIds(v);
    expect(overviewIds(v)).toEqual(before);
    expect(before.filter((id) => id.includes("example-site.io")).length).toBeLessThanOrEqual(3);
  });

  it("copes with an empty diagram and with edges to nodes that are not there", () => {
    expect(applyOverview(view([], [])).view.nodes).toEqual([]);
    expect(applyOverview(view([node("process:a")], [edge("process:a", "ghost")])).view.edges).toEqual([]);
  });
});

describe("full view modes", () => {
  it("main flow has no limit, whole shows everything, and choosing shows exactly what was chosen", () => {
    const { nodes, edges } = webApp();
    const v = view(nodes, edges);
    expect(applyFocus(v, { mode: "main" }).shown).toBe(6);
    expect(applyFocus(v, { mode: "all" }).view.nodes).toHaveLength(nodes.length);
    const many = nodes.filter((n) => n.kind === "process").map((n) => n.id);
    expect(many.length).toBeGreaterThan(10);
    expect(applyFocus(v, { mode: "pick", picked: many }).view.nodes).toHaveLength(many.length); // sem limite
    expect(applyFocus(v, { mode: "pick", picked: ["process:app/api", "process:gone", "process:app/api"] }).view.nodes.map((n) => n.id)).toEqual(["process:app/api"]);
    expect(applyFocus(v, { mode: "pick", picked: [] }).view.nodes).toEqual([]);
  });

  it("whole diagram can still hide whole kinds of component", () => {
    const { nodes, edges } = webApp();
    const noFolders = applyFocus(view(nodes, edges), { mode: "all", kinds: new Set<GraphNodeKind>(["data_store", "external_entity"]) });
    expect(noFolders.view.nodes.every((n) => n.kind !== "process")).toBe(true);
  });
});

describe("the list to pick from", () => {
  it("is sorted by importance by default: the client and the data stores before plain folders", () => {
    const { nodes, edges } = webApp();
    const rows = listNodes(view(nodes, edges));
    expect(rows.slice(0, 4).map((r) => r.id)).toEqual(expect.arrayContaining([CLIENT.id, DB.id]));
    expect(rows[rows.length - 1].id).toMatch(/process:(tests|docs_src)/);
  });

  it("can be sorted by name and by kind", () => {
    const { nodes, edges } = webApp();
    const byName = listNodes(view(nodes, edges), { sort: "name" }).map((r) => r.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    const byKind = listNodes(view(nodes, edges), { sort: "kind" }).map((r) => r.kind);
    expect(byKind[0]).toBe("process");
    expect(byKind[byKind.length - 1]).toBe("external_entity");
  });

  it("filters by kind and by text (name, path or technology)", () => {
    const { nodes, edges } = webApp();
    const v = view(nodes, edges);
    expect(listNodes(v, { kinds: new Set<GraphNodeKind>(["data_store"]) }).map((r) => r.name)).toEqual(["PostgreSQL"]);
    expect(listNodes(v, { query: "STRIPE" }).map((r) => r.id)).toEqual(["external_entity:stripe"]);
    expect(listNodes(v, { query: "postgres" }).map((r) => r.id)).toEqual(["data_store:postgresql"]);
    expect(listNodes(v, { query: "nothing like this" })).toEqual([]);
  });

  it("counts the connections of each component", () => {
    const { nodes, edges } = webApp();
    expect(scoreNodes(view(nodes, edges)).get(DB.id)!.connections).toBe(1);
    expect(ALL_KINDS).toHaveLength(3);
  });
});
