import { describe, expect, it } from "vitest";
import { declutterEdges, edgeKind, edgeStyle, markEdges } from "./declutter";
import type { GraphView } from "./project";
import type { GraphEdge, GraphNode } from "./schema";

const provenance = { source: "code" as const, confidence: "medium" as const, evidence: [{ note: "t" }] };
const node = (id: string): GraphNode => ({ id, kind: "process", name: id, path: id, provenance });
const edge = (source: string, target: string, label = "imports", extra?: Record<string, unknown>): GraphEdge => ({
  id: `${source}->${target}:${label}`, source, target, label, provenance, ...(extra ? { extra } : {}),
});
const view = (ids: string[], edges: GraphEdge[]): GraphView => ({ nodes: ids.map(node), edges, children: {} });
const pairs = (edges: GraphEdge[]) => edges.map((e) => `${e.source}>${e.target}:${e.label}`).sort();

/** O que cada nó alcança seguindo as ligações (para ver que nada deixou de se alcançar). */
function reachability(edges: GraphEdge[], ids: string[]): string[] {
  const out = new Map<string, string[]>();
  for (const e of edges) (out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(e.target);
  return ids.map((start) => {
    const seen = new Set<string>();
    const queue = [...(out.get(start) ?? [])];
    for (let i = 0; i < queue.length; i++) {
      if (seen.has(queue[i])) continue;
      seen.add(queue[i]);
      queue.push(...(out.get(queue[i]) ?? []));
    }
    return `${start}:${[...seen].sort().join(",")}`;
  });
}

describe("edgeKind", () => {
  it("tells a code dependency from data that really flows", () => {
    expect(edgeKind("imports")).toBe("dependency");
    expect(edgeKind("IMPORTS")).toBe("dependency");
    for (const label of ["calls", "reads", "writes", "reads/writes", "HTTP requests", "publishes", "depends on", ""]) expect(edgeKind(label)).toBe("flow");
  });
});

describe("declutterEdges", () => {
  it("drops a dependency that a longer path already implies", () => {
    const v = view(["a", "b", "c"], [edge("a", "b"), edge("b", "c"), edge("a", "c")]);
    expect(pairs(declutterEdges(v).edges)).toEqual(["a>b:imports", "b>c:imports"]);
  });

  it("never drops a line of real data flow, even if a path implies it", () => {
    const v = view(["a", "b", "c"], [edge("a", "b"), edge("b", "c"), edge("a", "c", "calls")]);
    expect(pairs(declutterEdges(v).edges)).toEqual(["a>b:imports", "a>c:calls", "b>c:imports"]);
  });

  it("drops the dependency between two components that also have a data flow between them", () => {
    const v = view(["a", "b"], [edge("a", "b"), edge("a", "b", "reads")]);
    expect(pairs(declutterEdges(v).edges)).toEqual(["a>b:reads"]);
  });

  it("draws two components that depend on each other as one line with two arrows", () => {
    const v = view(["a", "b"], [edge("a", "b"), edge("b", "a")]);
    const { edges } = declutterEdges(v);
    expect(edges).toHaveLength(1);
    expect(edges[0].label).toBe("imports");
    expect(edges[0].extra?.bidirectional).toBe(true);
  });

  it("keeps a mutual dependency and a data flow between the same two as two different things", () => {
    const v = view(["a", "b"], [edge("a", "b", "calls"), edge("b", "a")]);
    expect(pairs(declutterEdges(v).edges)).toEqual(["a>b:calls", "b>a:imports"]);
  });

  it("keeps everything reachable that was reachable (it only removes what is implied)", () => {
    // grafos pseudo-aleatórios, sempre os mesmos
    let seed = 7;
    const next = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let round = 0; round < 60; round++) {
      const ids = Array.from({ length: 4 + Math.floor(next() * 8) }, (_, i) => `n${i}`);
      const edges: GraphEdge[] = [];
      for (let k = 0; k < ids.length * 2; k++) {
        const a = ids[Math.floor(next() * ids.length)];
        const b = ids[Math.floor(next() * ids.length)];
        if (a !== b && !edges.some((e) => e.source === a && e.target === b)) edges.push(edge(a, b, next() < 0.25 ? "calls" : "imports"));
      }
      const reduced = declutterEdges(view(ids, edges)).edges;
      // a ligação nos dois sentidos conta como dois sentidos
      const expand = (list: GraphEdge[]) => list.flatMap((e) => (e.extra?.bidirectional ? [e, { ...e, source: e.target, target: e.source }] : [e]));
      expect(reachability(expand(reduced), ids), `ronda ${round}`).toEqual(reachability(edges, ids));
      expect(reduced.length).toBeLessThanOrEqual(edges.length);
    }
  });

  it("makes a typical dependency-heavy graph a lot lighter", () => {
    // uma cadeia onde cada módulo importa todos os seguintes: o desenho mostra só a cadeia
    const ids = Array.from({ length: 8 }, (_, i) => `m${i}`);
    const edges = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => edge(a, b)));
    expect(edges).toHaveLength(28);
    expect(declutterEdges(view(ids, edges)).edges).toHaveLength(7);
  });

  it("does not change its input, gives the same answer every time and leaves the nodes alone", () => {
    const v = view(["a", "b", "c"], [edge("a", "c"), edge("b", "c"), edge("a", "b")]);
    const before = JSON.stringify(v);
    const first = declutterEdges(v);
    expect(JSON.stringify(v)).toBe(before);
    expect(declutterEdges(v)).toEqual(first);
    expect(first.nodes).toBe(v.nodes);
    expect(first.children).toBe(v.children);
  });

  it("copes with no edges, one edge, self loops and edges to nodes that are not there", () => {
    expect(declutterEdges(view(["a"], [])).edges).toEqual([]);
    expect(pairs(declutterEdges(view(["a", "b"], [edge("a", "b")])).edges)).toEqual(["a>b:imports"]);
    expect(declutterEdges(view(["a"], [edge("a", "a")])).edges).toEqual([]);
    expect(pairs(declutterEdges(view(["a"], [edge("a", "ghost")])).edges)).toEqual(["a>ghost:imports"]);
  });
});

describe("edgeStyle", () => {
  it("draws data flows firm and with their label, and dependencies thin, dashed and without one", () => {
    const flow = edgeStyle("flow", "normal");
    const dependency = edgeStyle("dependency", "normal");
    expect(flow.showLabel).toBe(true);
    expect(dependency.showLabel).toBe(false);
    expect(dependency.width).toBeLessThan(flow.width);
    expect(dependency.dash).toBeTruthy();
    expect(flow.dash).toBeUndefined();
  });

  it("highlights what touches the selection and fades the rest", () => {
    expect(edgeStyle("flow", "active").width).toBeGreaterThan(edgeStyle("flow", "normal").width);
    expect(edgeStyle("flow", "dim").opacity).toBeLessThan(edgeStyle("flow", "normal").opacity);
    expect(edgeStyle("flow", "dim").showLabel).toBe(false);
    // a dependency of the selected component is worth a label now: it says what the selection depends on
    expect(edgeStyle("dependency", "active").showLabel).toBe(true);
  });
});

describe("markEdges", () => {
  const edges = [{ id: "e1", source: "a", target: "b" }, { id: "e2", source: "b", target: "c" }, { id: "e3", source: "x", target: "y" }];

  it("without a selection every edge is normal", () => {
    expect(markEdges(edges, new Set()).map((e) => e.state)).toEqual(["normal", "normal", "normal"]);
  });

  it("with a selection the edges of the selected components are active and the others dim", () => {
    expect(markEdges(edges, new Set(["b"])).map((e) => e.state)).toEqual(["active", "active", "dim"]);
  });

  it("an edge that is itself selected is active", () => {
    expect(markEdges(edges, new Set(), new Set(["e3"])).map((e) => e.state)).toEqual(["dim", "dim", "active"]);
  });
});
