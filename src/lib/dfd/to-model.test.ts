import { describe, expect, it } from "vitest";
import votingDetail from "./__fixtures__/voting-detail.json";
import votingFiles from "./__fixtures__/voting-files.json";
import { combineGraphs } from "./combine";
import { buildOverview } from "./overview";
import { selectConfigFiles } from "./overview/select";
import { detailView, overviewView, project } from "./project";
import { graphToDfdModel } from "./to-model";
import type { DfdGraph, GraphNode } from "./schema";

const files = selectConfigFiles(Object.keys(votingFiles)).map((path) => ({ path, text: (votingFiles as Record<string, string>)[path] }));
const overview = buildOverview({ owner: "dockersamples", repo: "example-voting-app", files, now: "2026-11-14T12:00:00Z" });
const model = graphToDfdModel(overviewView(overview));
const node = (id: string) => model.nodes.find((n) => n.id === id)!;

describe("graphToDfdModel on a real overview (the voting app)", () => {
  it("has one model node per graph node and one flow per edge", () => {
    expect(model.nodes).toHaveLength(overview.nodes.length);
    expect(model.edges).toHaveLength(overview.edges.length);
    expect(model.flows).toHaveLength(model.edges.length);
  });

  it("maps the kinds the scene knows", () => {
    expect(node("external_entity:client").kind).toBe("external");
    expect(node("process:vote").kind).toBe("process");
    expect(node("data_store:db").kind).toBe("store");
  });

  it("numbers the components with a stable, unique code, entities first", () => {
    const codes = model.nodes.map((n) => n.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(node("external_entity:client").code).toBe("EN-001");
    expect(codes[codes.length - 1]).toMatch(/^DS-/);
    expect(graphToDfdModel(overviewView(overview)).nodes.map((n) => n.code)).toEqual(codes);
  });

  it("describes each node for a person", () => {
    expect(node("external_entity:client")).toMatchObject({ title: "User / Client", subtitle: "EXTERNAL ENTITY", classification: "External entry" });
    expect(node("process:vote")).toMatchObject({ subtitle: "PROCESS", classification: "Internal service" });
    expect(node("data_store:db")).toMatchObject({ subtitle: "POSTGRESQL", classification: "Database", technology: "postgresql" });
  });

  it("carries the proof: where it was declared, and how sure", () => {
    const vote = node("process:vote");
    expect(vote.confidence).toBe("high");
    expect(vote.evidence?.[0]).toMatchObject({ file: "docker-compose.yml", note: "service 'vote'" });
    expect(typeof vote.evidence?.[0].line).toBe("number");
    expect(node("data_store:db").evidence?.some((e) => e.note?.startsWith("heuristic"))).toBe(true);
  });

  it("starts with no findings: those come from the threat analysis, not from the architecture", () => {
    expect(model.nodes.every((n) => n.findingIds.length === 0)).toBe(true);
  });

  it("does not claim a trust boundary it cannot know", () => {
    expect(model.boundary).toBeUndefined();
  });

  it("places every shape inside the drawing area, with room around it", () => {
    const { width, height } = model.viewBox!;
    for (const n of model.nodes) {
      expect(n.x).toBeGreaterThan(40);
      expect(n.y).toBeGreaterThan(20);
      expect(n.x).toBeLessThan(width - 40);
      expect(n.y).toBeLessThan(height - 20);
    }
  });

  it("places no two components on top of each other", () => {
    const box = { external: [66, 27], process: [43, 43], store: [73, 35] } as const;
    for (const a of model.nodes) {
      for (const b of model.nodes) {
        if (a.id >= b.id) continue;
        const overlapX = Math.abs(a.x - b.x) < box[a.kind][0] + box[b.kind][0];
        const overlapY = Math.abs(a.y - b.y) < box[a.kind][1] + box[b.kind][1];
        expect(overlapX && overlapY, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it("draws a curve between the shapes it connects, and the edges name valid handles", () => {
    for (const edge of model.edges) {
      expect(["r", "b"]).toContain(edge.sourceHandle);
      expect(["l", "t"]).toContain(edge.targetHandle);
      expect(edge.label).toBe(edge.label.toUpperCase());
    }
    for (const d of model.flows) expect(d).toMatch(/^M-?[\d.]+ -?[\d.]+ C(-?[\d.]+ -?[\d.]+ ?){3}$/);
  });

  it("starts each flow on the border of its source and ends it on the border of its target", () => {
    const half = { external: [66, 27], process: [43, 43], store: [73, 35] } as const;
    model.edges.forEach((edge, i) => {
      const nums = model.flows[i].match(/-?[\d.]+/g)!.map(Number);
      const [sx, sy, , , , , tx, ty] = nums;
      const s = node(edge.source);
      const t = node(edge.target);
      const onBorder = (n: typeof s, x: number, y: number) => Math.abs(Math.abs(x - n.x) - half[n.kind][0]) < 0.2 || Math.abs(Math.abs(y - n.y) - half[n.kind][1]) < 0.2;
      expect(onBorder(s, sx, sy), `start of ${edge.id}`).toBe(true);
      expect(onBorder(t, tx, ty), `end of ${edge.id}`).toBe(true);
    });
  });
});

describe("graphToDfdModel in general", () => {
  it("drops the npm scope from a title, which only takes room in the drawing", () => {
    const g = buildOverview({ owner: "o", repo: "r", now: "x", files: [{ path: "apps/web/package.json", text: `{"name":"@acme/web","dependencies":{"next":"15"}}` }] });
    expect(graphToDfdModel(overviewView(g)).nodes.find((n) => n.id === "process:apps/web")?.title).toBe("web");
  });

  it("does not stretch a tiny diagram: it keeps a minimum area and sits in the middle of it", () => {
    const app = buildOverview({ owner: "o", repo: "flask", now: "x", files: [] });
    const m = graphToDfdModel(overviewView(app));
    expect(m.nodes).toHaveLength(1);
    expect(m.viewBox!.width).toBeGreaterThanOrEqual(640);
    expect(m.viewBox!.height).toBeGreaterThanOrEqual(280);
    expect(Math.abs(m.nodes[0].x - m.viewBox!.width / 2)).toBeLessThan(2);
    expect(Math.abs(m.nodes[0].y - m.viewBox!.height / 2)).toBeLessThan(2);
  });

  it("keeps the flows and the shapes together when it centres a small diagram", () => {
    const small = buildOverview({ owner: "o", repo: "r", now: "x", files: [{ path: "compose.yml", text: "services:\n  a:\n    build: ./a\n  db:\n    image: postgres\n    ports: ['5432:5432']\n  b:\n    build: ./b\n    depends_on: [db]\n" }] });
    const m = graphToDfdModel(overviewView(small));
    const half = { external: [66, 27], process: [43, 43], store: [73, 35] } as const;
    m.edges.forEach((edge, i) => {
      const [sx, sy, , , , , tx, ty] = m.flows[i].match(/-?[\d.]+/g)!.map(Number);
      const s = m.nodes.find((n) => n.id === edge.source)!;
      const t = m.nodes.find((n) => n.id === edge.target)!;
      const onBorder = (n: typeof s, x: number, y: number) => Math.abs(Math.abs(x - n.x) - half[n.kind][0]) < 0.2 || Math.abs(Math.abs(y - n.y) - half[n.kind][1]) < 0.2;
      expect(onBorder(s, sx, sy) && onBorder(t, tx, ty), edge.id).toBe(true);
    });
  });

  it("copes with an empty graph", () => {
    const m = graphToDfdModel({ nodes: [], edges: [], children: {} });
    expect(m.nodes).toEqual([]);
    expect(m.flows).toEqual([]);
    expect(m.viewBox!.width).toBeGreaterThan(0);
  });

  it("ignores an edge whose end is not in the view", () => {
    const m = graphToDfdModel({ nodes: overview.nodes.slice(0, 1), edges: overview.edges.slice(0, 3), children: {} });
    expect(m.edges).toEqual([]);
    expect(m.flows).toEqual([]);
  });

  it("calls proxies, queues and third parties what they are", () => {
    const g = buildOverview({
      owner: "o", repo: "r", now: "x",
      files: [
        { path: "compose.yml", text: "services:\n  edge:\n    image: nginx\n    ports: ['80:80']\n  app:\n    build: ./app\n    depends_on: [mq]\n  mq:\n    image: rabbitmq\n" },
        { path: "app/package.json", text: `{"dependencies":{"stripe":"1"}}` },
      ],
    });
    const m = graphToDfdModel(overviewView(g));
    const byId = (id: string) => m.nodes.find((n) => n.id === id)!;
    expect(byId("process:edge")).toMatchObject({ subtitle: "PROXY", classification: "Proxy" });
    expect(byId("data_store:mq")).toMatchObject({ subtitle: "QUEUE", classification: "Message queue" });
    expect(byId("external_entity:stripe")).toMatchObject({ subtitle: "THIRD PARTY", classification: "Third-party service" });
  });

  it("draws the combined detail view too, however many nodes it has", () => {
    const combined = combineGraphs(overview, votingDetail as unknown as DfdGraph);
    const big = graphToDfdModel(detailView(combined));
    expect(big.nodes).toHaveLength(combined.nodes.length);
    expect(big.flows).toHaveLength(big.edges.length);
    expect(big.viewBox!.width).toBeGreaterThan(model.viewBox!.width - 1);
  });
});

describe("graphToDfdModel with the code analysis combined in", () => {
  const combined = combineGraphs(overview, votingDetail as unknown as DfdGraph);
  const closed = graphToDfdModel(project(combined));
  const opened = graphToDfdModel(project(combined, { expanded: new Set(["process:vote"]) }));
  const at = (m: typeof closed, id: string) => m.nodes.find((n) => n.id === id)!;

  it("says which components can be opened and how many parts they have", () => {
    expect(at(closed, "process:vote")).toMatchObject({ expandable: 1, expanded: false });
    expect(at(closed, "process:result")).toMatchObject({ expandable: 2, expanded: false });
    expect(at(closed, "data_store:db").expandable).toBeUndefined();
    expect(at(closed, "process:worker").expandable).toBeUndefined();
  });

  it("draws no containment while everything is closed", () => {
    expect(closed.containment).toBeUndefined();
    expect(closed.nodes.every((n) => !n.expanded)).toBe(true);
  });

  it("shows the parts of an opened component, tied to it by a containment stroke", () => {
    expect(opened.nodes.map((n) => n.id)).toContain("process:vote/templates");
    expect(at(opened, "process:vote")).toMatchObject({ expandable: 1, expanded: true });
    expect(opened.containment).toHaveLength(1);
    expect(opened.containment![0]).toMatch(/^M-?[\d.]+ -?[\d.]+ C/);
    expect(opened.nodes).toHaveLength(closed.nodes.length + 1);
  });

  it("keeps the other components closed, and the parts of an opened one to its right", () => {
    expect(at(opened, "process:result").expanded).toBe(false);
    expect(at(opened, "process:vote/templates").x).toBeGreaterThan(at(opened, "process:vote").x);
  });

  it("does not overlap shapes after opening", () => {
    const box = { external: [66, 27], process: [43, 43], store: [73, 35] } as const;
    for (const a of opened.nodes) for (const b of opened.nodes) {
      if (a.id >= b.id) continue;
      expect(Math.abs(a.x - b.x) < box[a.kind][0] + box[b.kind][0] && Math.abs(a.y - b.y) < box[a.kind][1] + box[b.kind][1], `${a.id} overlaps ${b.id}`).toBe(false);
    }
  });

  it("opens everything for the full detail view, with one containment stroke per part", () => {
    const all = graphToDfdModel(detailView(combined));
    const parts = Object.values(combined.nodes.filter((n) => n.parent)).length;
    expect(all.containment).toHaveLength(parts);
    expect(all.nodes).toHaveLength(combined.nodes.length);
  });

  it("describes the code behind a component in plain words", () => {
    const result = at(closed, "process:result");
    expect(result.facts).toEqual(expect.arrayContaining([expect.stringMatching(/^\d+ files?$/), "image dockersamples/examplevotingapp_result"].slice(0, 1)));
    expect(result.facts?.some((f) => /javascript \d+/.test(f))).toBe(true);
    expect(result.facts?.some((f) => /^ports /.test(f))).toBe(true);
    expect(at(closed, "data_store:db").facts).toBeUndefined();
  });

  it("counts HTTP routes only when there are some, and says 1 file, not 1 files", () => {
    const one = buildOverview({ owner: "o", repo: "r", now: "x", files: [] });
    const node = { ...one.nodes[0], extra: { file_count: 1, route_count: 1, languages: { python: 1 } } };
    const m = graphToDfdModel({ nodes: [node], edges: [], children: {} });
    expect(m.nodes[0].facts).toEqual(["1 file", "python 1", "1 HTTP route"]);
    const none = graphToDfdModel({ nodes: [{ ...one.nodes[0], extra: { file_count: 3, route_count: 0 } }], edges: [], children: {} });
    expect(none.nodes[0].facts).toEqual(["3 files"]);
  });
});

describe("repeated folder names", () => {
  const node = (path: string): GraphNode => ({ id: `process:${path}`, kind: "process", name: path.split("/").pop()!, path, provenance: { source: "code", confidence: "medium", evidence: [{ note: "x" }] } });
  const titlesOf = (paths: string[]) => graphToDfdModel({ nodes: paths.map(node), edges: [], children: {} }).nodes.map((n) => n.title);

  it("keeps a name that is not repeated", () => {
    expect(titlesOf(["api", "web/pages"])).toEqual(["api", "pages"]);
  });

  it("adds the folder above to the repeated ones, and only to them", () => {
    expect(titlesOf(["tests/templates", "examples/shop/templates", "api"])).toEqual(["tests/templates", "shop/templates", "api"]);
  });

  it("goes as deep as it takes to tell them apart", () => {
    expect(titlesOf(["a/x/templates", "b/x/templates"])).toEqual(["a/x/templates", "b/x/templates"]);
  });

  it("gives every folder of a real combined graph a different title once all are shown", () => {
    const empty = buildOverview({ owner: "o", repo: "r", now: "x", files: [] });
    const real = combineGraphs(empty, { ...(votingDetail as unknown as DfdGraph), nodes: (votingDetail as unknown as DfdGraph).nodes.concat([node("a/templates"), node("b/templates")]) });
    const titles = graphToDfdModel(detailView(real)).nodes.filter((n) => n.kind === "process").map((n) => n.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
