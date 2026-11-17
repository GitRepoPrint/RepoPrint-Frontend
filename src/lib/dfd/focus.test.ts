import { describe, expect, it } from "vitest";
import { ALL_KINDS, MAX_FOCUS_NODES, applyFocus, isAuxiliary, listNodes, mainFlowIds, scoreNodes } from "./focus";
import type { GraphView } from "./project";
import type { GraphEdge, GraphNode, GraphNodeKind } from "./schema";

const provenance = { source: "code" as const, confidence: "medium" as const, evidence: [{ note: "test" }] };

function node(id: string, kind: GraphNodeKind = "process", extra: Partial<GraphNode> = {}): GraphNode {
  return { id, kind, name: id, provenance, ...extra };
}

function edge(source: string, target: string, label = "imports"): GraphEdge {
  return { id: `${source}->${target}:${label}`, source, target, label, provenance };
}

const view = (nodes: GraphNode[], edges: GraphEdge[]): GraphView => ({ nodes, edges, children: {} });

/** Um serviço grande: 40 pastas que se importam em cadeia, um cliente, duas bases de dados e um serviço de fora. */
function bigView(): GraphView {
  const folders = Array.from({ length: 40 }, (_, i) => node(`process:f${String(i).padStart(2, "0")}`));
  const nodes = [
    node("external_entity:client", "external_entity", { name: "User / Client", tags: ["client"] }),
    node("data_store:postgresql", "data_store", { name: "PostgreSQL", technology: "postgresql" }),
    node("data_store:redis", "data_store", { name: "Redis", technology: "redis" }),
    node("external_entity:stripe", "external_entity", { name: "api.stripe.com", tags: ["third-party"] }),
    ...folders,
  ];
  const edges = [
    edge("external_entity:client", "process:f00", "HTTP requests"),
    edge("process:f00", "data_store:postgresql", "reads"),
    edge("process:f01", "data_store:postgresql", "writes"),
    edge("process:f02", "data_store:redis", "reads/writes"),
    edge("process:f03", "external_entity:stripe", "calls"),
    ...folders.slice(0, -1).map((f, i) => edge(f.id, folders[i + 1].id)),
  ];
  return view(nodes, edges);
}

describe("the main data flow", () => {
  it("never shows more than the maximum, however big the diagram is", () => {
    const { view: shown, total, shown: count } = applyFocus(bigView(), { mode: "main" });
    expect(total).toBe(44);
    expect(shown.nodes).toHaveLength(MAX_FOCUS_NODES);
    expect(count).toBe(MAX_FOCUS_NODES);
    expect(MAX_FOCUS_NODES).toBe(10);
  });

  it("keeps where the data comes in and where it is stored", () => {
    const ids = applyFocus(bigView(), { mode: "main" }).view.nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(["external_entity:client", "data_store:postgresql", "data_store:redis"]));
  });

  it("is one connected piece of the diagram, not ten loose parts", () => {
    const { view: shown } = applyFocus(bigView(), { mode: "main" });
    const reached = new Set([shown.nodes[0].id]);
    for (let round = 0; round < shown.nodes.length; round++) {
      for (const e of shown.edges) {
        if (reached.has(e.source)) reached.add(e.target);
        if (reached.has(e.target)) reached.add(e.source);
      }
    }
    expect(reached.size).toBe(shown.nodes.length);
  });

  it("only keeps edges whose two ends are both visible", () => {
    const { view: shown } = applyFocus(bigView(), { mode: "main" });
    const ids = new Set(shown.nodes.map((n) => n.id));
    expect(shown.edges.length).toBeGreaterThan(0);
    expect(shown.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });

  it("gives the same answer every time", () => {
    expect(mainFlowIds(bigView())).toEqual(mainFlowIds(bigView()));
  });

  it("shows everything when the diagram already fits", () => {
    const small = view([node("a"), node("b"), node("c")], [edge("a", "b"), edge("b", "c")]);
    expect(applyFocus(small, { mode: "main" }).view.nodes).toHaveLength(3);
  });

  it("jumps to a loose component only when nothing connected is left", () => {
    const v = view([node("a"), node("b"), node("lonely")], [edge("a", "b")]);
    expect(mainFlowIds(v, { max: 3 })).toHaveLength(3);
    expect(mainFlowIds(v, { max: 2 })).not.toContain("lonely");
  });

  it("weighs data flowing over one folder importing another", () => {
    const v = view(
      [node("a"), node("b"), node("c"), node("d"), node("data_store:db", "data_store", { name: "db" })],
      [edge("a", "b"), edge("b", "c"), edge("c", "d"), edge("d", "data_store:db", "reads")],
    );
    expect(mainFlowIds(v, { max: 2 })).toContain("data_store:db");
  });

  it("always includes a pinned component (the selected one) and still respects the maximum", () => {
    const ids = mainFlowIds(bigView(), { pinned: ["process:f39"] });
    expect(ids).toContain("process:f39");
    expect(ids).toHaveLength(MAX_FOCUS_NODES);
  });

  it("prefers the parts of a component the user opened", () => {
    const v = bigView();
    const ids = mainFlowIds(v, { boost: new Set(["process:f30", "process:f31", "process:f32"]) });
    expect(ids).toEqual(expect.arrayContaining(["process:f30", "process:f31", "process:f32"]));
    expect(ids).toHaveLength(MAX_FOCUS_NODES);
  });

  it("can be narrowed to some kinds of component, and still respects the maximum", () => {
    const processesOnly = applyFocus(bigView(), { mode: "main", kinds: new Set<GraphNodeKind>(["process"]) });
    expect(processesOnly.view.nodes).toHaveLength(MAX_FOCUS_NODES);
    expect(processesOnly.view.nodes.every((n) => n.kind === "process")).toBe(true);
  });

  it("honours a lower maximum", () => {
    expect(applyFocus(bigView(), { mode: "main", max: 4 }).view.nodes).toHaveLength(4);
  });

  it("copes with an empty diagram and with edges to nodes that are not there", () => {
    expect(applyFocus(view([], []), { mode: "main" }).view.nodes).toEqual([]);
    const dangling = view([node("a")], [edge("a", "ghost")]);
    expect(applyFocus(dangling, { mode: "main" }).view.edges).toEqual([]);
  });
});

describe("tests, docs and scripts", () => {
  it("recognise auxiliary folders by any part of the path", () => {
    const folder = (path: string) => node(`process:${path}`, "process", { name: path.split("/").pop()!, path });
    for (const path of ["tests", "src/tests/unit", "docs_src/tutorial", "examples", "scripts", "pkg/test_telemetry", "app/e2e", "benchmarks"]) {
      expect(isAuxiliary(folder(path)), path).toBe(true);
    }
    for (const path of ["fastapi", "src/app/users", "app/contests", "latest", "api"]) expect(isAuxiliary(folder(path)), path).toBe(false);
    expect(isAuxiliary(node("data_store:test", "data_store", { name: "tests" }))).toBe(false);
  });

  it("make way for the product code in the main flow, even when they are better connected", () => {
    const app = node("process:app", "process", { name: "app", path: "app" });
    const core = node("process:core", "process", { name: "core", path: "core" });
    const tests = node("process:tests", "process", { name: "tests", path: "tests" });
    const v = view([app, core, tests], [edge("tests", "app"), edge("tests", "core"), edge("app", "core")]);
    expect(mainFlowIds(v, { max: 2 })).not.toContain("process:tests");
    expect(mainFlowIds(v, { max: 3 })).toContain("process:tests"); // continuam a aparecer quando há lugar
  });
});

describe("choosing components", () => {
  it("shows exactly what was chosen", () => {
    const { view: shown, overflow } = applyFocus(bigView(), { mode: "pick", picked: ["process:f05", "data_store:redis"] });
    expect(shown.nodes.map((n) => n.id).sort()).toEqual(["data_store:redis", "process:f05"]);
    expect(overflow).toBe(0);
  });

  it("enforces the maximum on the choice and reports what did not fit", () => {
    const picked = Array.from({ length: 14 }, (_, i) => `process:f${String(i).padStart(2, "0")}`);
    const result = applyFocus(bigView(), { mode: "pick", picked });
    expect(result.view.nodes).toHaveLength(MAX_FOCUS_NODES);
    expect(result.overflow).toBe(4);
  });

  it("ignores choices that are no longer in the diagram and repeated ones", () => {
    const result = applyFocus(bigView(), { mode: "pick", picked: ["process:gone", "process:f01", "process:f01"] });
    expect(result.view.nodes.map((n) => n.id)).toEqual(["process:f01"]);
  });

  it("shows nothing for an empty choice", () => {
    expect(applyFocus(bigView(), { mode: "pick", picked: [] }).view.nodes).toEqual([]);
  });
});

describe("the whole diagram", () => {
  it("is not limited, because the user asked for all of it", () => {
    const result = applyFocus(bigView(), { mode: "all" });
    expect(result.view.nodes).toHaveLength(44);
    expect(result.view.edges).toHaveLength(bigView().edges.length);
  });

  it("can still hide whole kinds of component", () => {
    const noFolders = applyFocus(bigView(), { mode: "all", kinds: new Set<GraphNodeKind>(["data_store", "external_entity"]) });
    expect(noFolders.view.nodes).toHaveLength(4);
  });
});

describe("the list to pick from", () => {
  it("is sorted by importance by default: the client and the data stores before plain folders", () => {
    const rows = listNodes(bigView());
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual(expect.arrayContaining(["external_entity:client", "data_store:postgresql"]));
    expect(rows[rows.length - 1].kind).toBe("process");
  });

  it("can be sorted by name and by kind", () => {
    const byName = listNodes(bigView(), { sort: "name" }).map((r) => r.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    const byKind = listNodes(bigView(), { sort: "kind" }).map((r) => r.kind);
    expect(byKind[0]).toBe("process");
    expect(byKind[byKind.length - 1]).toBe("external_entity");
  });

  it("filters by kind and by text (name, path or technology)", () => {
    expect(listNodes(bigView(), { kinds: new Set<GraphNodeKind>(["data_store"]) }).map((r) => r.name).sort()).toEqual(["PostgreSQL", "Redis"]);
    expect(listNodes(bigView(), { query: "STRIPE" }).map((r) => r.id)).toEqual(["external_entity:stripe"]);
    expect(listNodes(bigView(), { query: "postgres" }).map((r) => r.id)).toEqual(["data_store:postgresql"]);
    expect(listNodes(bigView(), { query: "nothing like this" })).toEqual([]);
  });

  it("counts the connections of each component", () => {
    const rows = new Map(scoreNodes(bigView()));
    expect(rows.get("data_store:postgresql")!.connections).toBe(2);
    expect(ALL_KINDS).toHaveLength(3);
  });
});
