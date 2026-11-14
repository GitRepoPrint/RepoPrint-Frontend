// Um grafo DFD (docs/dfd-schema.md, já projetado numa vista) -> o DfdModel que a pré-visualização do dashboard e o canvas
// já sabem desenhar: posições dos nós (Dagre), ligações com os lados por onde saem e o traço SVG de cada uma.
import dagre from "@dagrejs/dagre";
import type { DfdEdge, DfdEvidence, DfdModel, DfdNodeData, DfdNodeKind } from "@/lib/api/types";
import type { GraphView } from "./project";
import type { GraphNode, GraphNodeKind } from "./schema";

const KIND: Record<GraphNodeKind, DfdNodeKind> = { external_entity: "external", process: "process", data_store: "store" };
const CODE_PREFIX: Record<DfdNodeKind, string> = { external: "EN", process: "PR", store: "DS" };
const KIND_ORDER: Record<DfdNodeKind, number> = { external: 0, process: 1, store: 2 };

/** Meia largura e meia altura de cada forma, como o DfdScene as desenha. */
const HALF: Record<DfdNodeKind, { w: number; h: number }> = {
  external: { w: 66, h: 27 },
  process: { w: 43, h: 43 },
  store: { w: 73, h: 35 },
};
const MARGIN = 50;

/** "@acme/nextjs" -> "nextjs": o âmbito de um pacote npm só ocupa espaço no desenho. */
const displayName = (name: string) => name.replace(/^@[^/]+\//, "");

function subtitleOf(node: GraphNode): string {
  if (node.kind === "process") return node.tags?.includes("proxy") ? "PROXY" : "PROCESS";
  if (node.kind === "data_store") return node.tags?.includes("queue") ? "QUEUE" : (node.technology ?? "data store").replace(/-/g, " ").toUpperCase();
  if (node.tags?.includes("client")) return "EXTERNAL ENTITY";
  return node.tags?.includes("third-party") ? "THIRD PARTY" : "EXTERNAL ENTITY";
}

function classificationOf(node: GraphNode): string {
  if (node.kind === "process") return node.tags?.includes("proxy") ? "Proxy" : "Internal service";
  if (node.kind === "data_store") {
    if (node.tags?.includes("queue")) return "Message queue";
    return node.technology === "file-storage" || node.technology === "minio" ? "File storage" : "Database";
  }
  if (node.tags?.includes("client")) return "External entry";
  return node.tags?.includes("third-party") ? "Third-party service" : "External system";
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Muitas pastas chamam-se "templates": as repetidas ganham o caminho que as distingue ("task_app/templates",
 * "flaskr/templates"), com o mínimo de pastas que chegue.
 */
function disambiguate(nodes: GraphNode[]): Map<string, string> {
  const titles = new Map(nodes.map((n) => [n.id, displayName(n.name)]));
  const groups = new Map<string, GraphNode[]>();
  for (const n of nodes) groups.set(titles.get(n.id)!, [...(groups.get(titles.get(n.id)!) ?? []), n]);
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const segments = (n: GraphNode) => (n.path && n.path !== "." ? n.path.split("/") : []);
    const deepest = Math.max(...group.map((n) => segments(n).length));
    for (let take = 2; take <= deepest; take++) {
      const candidate = new Map(group.map((n) => [n.id, segments(n).slice(-take).join("/") || titles.get(n.id)!]));
      for (const n of group) titles.set(n.id, candidate.get(n.id)!);
      if (new Set(candidate.values()).size === group.length) break;
    }
  }
  return titles;
}

/** O que o código e a configuração dizem sobre o componente, em frases curtas (o que há em `extra`, de um ou de outro lado). */
function factsOf(node: GraphNode): string[] {
  const extra = node.extra ?? {};
  const facts: string[] = [];
  if (typeof extra.file_count === "number") facts.push(plural(extra.file_count, "file"));
  const languages = extra.languages && typeof extra.languages === "object" ? Object.entries(extra.languages as Record<string, unknown>) : [];
  const top = languages.filter((e): e is [string, number] => typeof e[1] === "number").sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) facts.push(top.map(([name, count]) => `${name} ${count}`).join(", "));
  if (typeof extra.route_count === "number" && extra.route_count > 0) facts.push(plural(extra.route_count, "HTTP route"));
  if (typeof extra.image === "string") facts.push(`image ${extra.image}`);
  if (Array.isArray(extra.ports) && extra.ports.length) facts.push(`ports ${extra.ports.join(", ")}`);
  return facts;
}

const evidenceOf = (node: GraphNode): DfdEvidence[] =>
  node.provenance.evidence.map((e) => ({
    ...(e.file ? { file: e.file } : {}),
    ...(typeof e.line === "number" ? { line: e.line } : {}),
    ...(e.note ? { note: e.note } : {}),
  }));

type Handles = Pick<DfdEdge, "sourceHandle" | "targetHandle">;

/** Destino bem à direita -> direita/esquerda; destino mais abaixo -> baixo/cima; senão direita/esquerda (a curva mais limpa). */
function handlesFor(source: DfdNodeData, target: DfdNodeData): Handles {
  const a = HALF[source.kind];
  const b = HALF[target.kind];
  const toTheRight = target.x - source.x >= a.w + b.w;
  const below = target.y - source.y >= a.h + b.h;
  return !toTheRight && below ? { sourceHandle: "b", targetHandle: "t" } : { sourceHandle: "r", targetHandle: "l" };
}

function anchor(node: DfdNodeData, handle: "r" | "l" | "b" | "t") {
  const { w, h } = HALF[node.kind];
  if (handle === "r") return { x: node.x + w, y: node.y };
  if (handle === "l") return { x: node.x - w, y: node.y };
  return handle === "b" ? { x: node.x, y: node.y + h } : { x: node.x, y: node.y - h };
}

const round = (n: number) => Math.round(n * 10) / 10;

function pathFor(source: DfdNodeData, target: DfdNodeData, handles: Handles): string {
  const from = anchor(source, handles.sourceHandle);
  const to = anchor(target, handles.targetHandle);
  if (handles.sourceHandle === "b") {
    const d = Math.max(24, Math.abs(to.y - from.y) / 2);
    return `M${round(from.x)} ${round(from.y)} C${round(from.x)} ${round(from.y + d)} ${round(to.x)} ${round(to.y - d)} ${round(to.x)} ${round(to.y)}`;
  }
  const d = Math.max(40, Math.abs(to.x - from.x) / 2);
  return `M${round(from.x)} ${round(from.y)} C${round(from.x + d)} ${round(from.y)} ${round(to.x - d)} ${round(to.y)} ${round(to.x)} ${round(to.y)}`;
}

/** Os nós ficam ordenados por tipo (entidades, processos, depósitos) para a numeração dos códigos ser estável. */
export function graphToDfdModel(view: GraphView): DfdModel {
  const ordered = [...view.nodes].sort((a, b) => KIND_ORDER[KIND[a.kind]] - KIND_ORDER[KIND[b.kind]]);
  const titles = disambiguate(ordered);

  const layout = new dagre.graphlib.Graph();
  layout.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 110, marginx: MARGIN, marginy: MARGIN });
  layout.setDefaultEdgeLabel(() => ({}));
  for (const n of ordered) layout.setNode(n.id, { width: HALF[KIND[n.kind]].w * 2, height: HALF[KIND[n.kind]].h * 2 });
  const known = new Set(ordered.map((n) => n.id));
  for (const e of view.edges) if (known.has(e.source) && known.has(e.target)) layout.setEdge(e.source, e.target);
  // Um componente aberto fica à esquerda das suas partes
  const visibleParts = (id: string) => (view.children[id] ?? []).filter((child) => known.has(child));
  for (const n of ordered) for (const child of visibleParts(n.id)) layout.setEdge(n.id, child);
  dagre.layout(layout);

  const nodes: DfdNodeData[] = ordered.map((n, index) => {
    const kind = KIND[n.kind];
    const { x, y } = layout.node(n.id);
    return {
      id: n.id,
      title: titles.get(n.id) ?? n.name,
      subtitle: subtitleOf(n),
      kind,
      x: round(x),
      y: round(y),
      code: `${CODE_PREFIX[kind]}-${String(index + 1).padStart(3, "0")}`,
      classification: classificationOf(n),
      findingIds: [],
      ...(n.technology ? { technology: n.technology } : {}),
      confidence: n.provenance.confidence,
      evidence: evidenceOf(n),
      ...(factsOf(n).length ? { facts: factsOf(n) } : {}),
      ...((view.children[n.id]?.length ?? 0) > 0 ? { expandable: view.children[n.id].length, expanded: visibleParts(n.id).length > 0 } : {}),
    };
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: DfdEdge[] = [];
  const flows: string[] = [];
  for (const e of view.edges) {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    if (!source || !target) continue;
    const handles = handlesFor(source, target);
    edges.push({ id: e.id, source: e.source, target: e.target, ...handles, label: e.label.toUpperCase() });
    flows.push(pathFor(source, target, handles));
  }

  const containment: string[] = [];
  for (const parent of nodes) {
    for (const childId of visibleParts(parent.id)) {
      const child = byId.get(childId);
      if (child) containment.push(pathFor(parent, child, handlesFor(parent, child)));
    }
  }

  // O Dagre devolve centros com margem; a área do SVG é a que cobre as formas com a mesma margem à volta
  const right = Math.max(0, ...nodes.map((n) => n.x + HALF[n.kind].w));
  const bottom = Math.max(0, ...nodes.map((n) => n.y + HALF[n.kind].h));
  return { viewBox: { width: Math.ceil(right + MARGIN), height: Math.ceil(bottom + MARGIN) }, nodes, flows, edges, ...(containment.length ? { containment } : {}) };
}
