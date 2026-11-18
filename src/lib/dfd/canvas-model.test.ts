import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDiagram, saveDiagram } from "@/lib/api/diagram";
import votingFiles from "./__fixtures__/voting-files.json";
import { diagramFromModel, toDiagram, toFlowEdges, toFlowNodes } from "./graph";
import { autoLayout } from "./layout";
import { buildOverview } from "./overview";
import { selectConfigFiles } from "./overview/select";
import { overviewView } from "./project";
import { graphToDfdModel } from "./to-model";

// O canvas recebe o DfdModel de um repositório real: ids com ":" e "/" (process:apps/web), códigos gerados, sem findings.
const files = selectConfigFiles(Object.keys(votingFiles)).map((path) => ({ path, text: (votingFiles as Record<string, string>)[path] }));
const model = graphToDfdModel(overviewView(buildOverview({ owner: "o", repo: "r", files, now: "x" })));

describe("the canvas with a real model", () => {
  const diagram = diagramFromModel(model);

  it("turns every component and flow into diagram nodes and edges, keeping the ids", () => {
    expect(diagram.nodes.map((n) => n.id)).toEqual(model.nodes.map((n) => n.id));
    expect(diagram.edges.map((e) => e.id)).toEqual(model.edges.map((e) => e.id));
    expect(diagram.nodes.every((n) => n.findingIds.length === 0)).toBe(true);
  });

  it("puts every node on the grid and on the page", () => {
    for (const n of diagram.nodes) {
      expect(n.position.x % 20).toBe(0);
      expect(n.position.y % 20).toBe(0);
      expect(n.position.x).toBeGreaterThanOrEqual(-100);
    }
  });

  it("survives the trip to React Flow and back unchanged", () => {
    expect(toDiagram(toFlowNodes(diagram), toFlowEdges(diagram))).toEqual(diagram);
  });

  it("can be laid out again, with every edge still pointing at nodes that exist", () => {
    const laid = autoLayout(diagram);
    const known = new Set(laid.nodes.map((n) => n.id));
    expect(laid.edges.every((e) => known.has(e.source) && known.has(e.target))).toBe(true);
    expect(laid.nodes).toHaveLength(diagram.nodes.length);
  });
});

describe("saving the diagram", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps what was drawn for a real repository and reads it back", () => {
    const diagram = diagramFromModel(model);
    expect(saveDiagram("o/r", diagram, true)).toBe(true);
    expect(loadDiagram("o/r", true)).toEqual(diagram);
  });

  it("keeps the inferred diagram apart from the demo one for the same repository name", () => {
    const diagram = diagramFromModel(model);
    saveDiagram("o/r", diagram, true);
    expect(loadDiagram("o/r", false)).toBeNull();
    saveDiagram("o/r", { nodes: [], edges: [] }, false);
    expect(loadDiagram("o/r", true)).toEqual(diagram);
  });

  it("refuses a saved diagram that no longer has the right shape", () => {
    store.set("repoprint-diagram:overview:o/r", JSON.stringify({ nodes: [{ id: 1 }], edges: [] }));
    expect(loadDiagram("o/r", true)).toBeNull();
  });
});

describe("edge types on the canvas", () => {
  const base = { id: "e", source: "a", target: "b", sourceHandle: "r" as const, targetHandle: "l" as const };

  it("a dependency stays a dependency across the trip to React Flow and back, and a flow stays a flow", () => {
    const [dep, flow] = toFlowEdges({ nodes: [], edges: [{ ...base, id: "d", label: "IMPORTS", kind: "dependency" }, { ...base, id: "f", label: "CALLS" }] });
    expect(dep.data).toMatchObject({ kind: "dependency" });
    expect(flow.data).toMatchObject({ kind: "flow" });
    const back = toDiagram([], [dep, flow]).edges;
    expect(back[0].kind).toBe("dependency");
    expect(back[1].kind).toBeUndefined();
  });

  it("a diagram saved before edges had types gets them from the label", () => {
    const [dep, flow] = toFlowEdges({ nodes: [], edges: [{ ...base, id: "d", label: "IMPORTS" }, { ...base, id: "f", label: "HTTP REQUESTS" }] });
    expect(dep.data?.kind).toBe("dependency");
    expect(flow.data?.kind).toBe("flow");
  });

  it("a two-way dependency has an arrow at each end, and it is kept when saved", () => {
    const [edge] = toFlowEdges({ nodes: [], edges: [{ ...base, label: "IMPORTS", kind: "dependency", bidirectional: true }] });
    expect(edge.markerStart).toBeTruthy();
    expect(edge.markerEnd).toBeTruthy();
    expect(toDiagram([], [edge]).edges[0].bidirectional).toBe(true);
    expect(toFlowEdges({ nodes: [], edges: [{ ...base, label: "CALLS" }] })[0].markerStart).toBeUndefined();
  });

  it("the highlight is only for drawing: it is not saved", () => {
    const [edge] = toFlowEdges({ nodes: [], edges: [{ ...base, label: "CALLS" }] });
    const saved = toDiagram([], [{ ...edge, data: { ...edge.data!, state: "dim" as const } }]).edges[0];
    expect(JSON.stringify(saved)).not.toContain("dim");
  });
});
