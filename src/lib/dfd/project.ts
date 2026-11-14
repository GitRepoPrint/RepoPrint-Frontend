// Vistas do grafo DFD (docs/dfd-schema.md, "Views are projections").
// Uma vista é uma função sobre o grafo, não uma segunda análise:
//   overview = nada expandido; detalhe = tudo expandido; expandir um componente mostra os seus filhos.
// Os componentes e os filhos vêm do campo `parent` (ver assignParents).
import type { Confidence, DfdGraph, Evidence, GraphEdge, GraphNode } from "./schema";

/** Ligações que dizem "este código importa aquele", não "dados fluem para ali". Ao subir para um componente, caem. */
export const CODE_DEPENDENCY_LABELS: readonly string[] = ["imports"];

const MAX_EVIDENCE = 5;
const MAX_LIST = 10;
const MAX_ROUTES = 20;
const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export interface GraphView {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Filhos diretos de cada componente (mesmo dos que estão fechados): é o que o "expandir" revela. */
  children: Record<string, string[]>;
}

export interface ProjectOptions {
  /** Componentes abertos; "all" abre todos (vista de detalhe). Por defeito nenhum (overview). */
  expanded?: ReadonlySet<string> | "all";
  /** Etiquetas de ligações que se descartam quando sobem para um componente. */
  dropLiftedLabels?: readonly string[];
}

/** id -> id do pai. Só conta pais que existem e são processos; quebra ciclos para um grafo mau não bloquear a interface. */
function validParents(nodes: GraphNode[]): Map<string, string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parent = new Map<string, string>();
  for (const n of nodes) {
    if (n.parent && n.parent !== n.id && byId.get(n.parent)?.kind === "process") parent.set(n.id, n.parent);
  }
  for (const n of nodes) {
    const seen = new Set([n.id]);
    let current = n.id;
    while (parent.has(current)) {
      const next = parent.get(current)!;
      if (seen.has(next)) {
        parent.delete(current);
        break;
      }
      seen.add(next);
      current = next;
    }
  }
  return parent;
}

/** O nó que representa `id` na vista: o ancestral mais alto que está fechado, ou o próprio nó se todos os de cima estão abertos. */
function representative(id: string, parent: Map<string, string>, isExpanded: (id: string) => boolean): string {
  const chain = [id];
  while (parent.has(chain[chain.length - 1])) chain.push(parent.get(chain[chain.length - 1])!);
  chain.reverse();
  let i = 0;
  while (i < chain.length - 1 && isExpanded(chain[i])) i++;
  return chain[i];
}

const sortedUnion = (lists: (readonly string[] | undefined)[], cap: number) =>
  [...new Set(lists.flatMap((l) => l ?? []))].sort().slice(0, cap);

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

function mergeEdges(source: string, target: string, label: string, group: GraphEdge[]): GraphEdge {
  const strongest = group.reduce((best, e) => (RANK[e.provenance.confidence] > RANK[best.provenance.confidence] ? e : best));
  const seen = new Set<string>();
  const evidence: Evidence[] = [];
  for (const item of group.flatMap((e) => e.provenance.evidence)) {
    const key = JSON.stringify(item);
    if (!seen.has(key) && evidence.length < MAX_EVIDENCE) {
      seen.add(key);
      evidence.push(item);
    }
  }
  const extra: Record<string, unknown> = { count: group.reduce((sum, e) => sum + (Number(e.extra?.count) || 1), 0) };
  const via = sortedUnion(group.map((e) => stringList(e.extra?.via)), MAX_LIST);
  if (via.length) extra.via = via;
  const routes = sortedUnion(group.map((e) => stringList(e.extra?.routes)), MAX_ROUTES);
  if (routes.length) extra.routes = routes;
  return {
    id: `${source}->${target}:${label}`,
    source,
    target,
    label,
    operations: sortedUnion(group.map((e) => e.operations), MAX_LIST),
    protocol: group.find((e) => e.protocol)?.protocol ?? null,
    provenance: { source: strongest.provenance.source, confidence: strongest.provenance.confidence, evidence },
    extra,
  };
}

export function project(graph: DfdGraph, options: ProjectOptions = {}): GraphView {
  const { expanded = new Set<string>(), dropLiftedLabels = CODE_DEPENDENCY_LABELS } = options;
  const isExpanded = expanded === "all" ? () => true : (id: string) => expanded.has(id);
  const parent = validParents(graph.nodes);
  const rep = new Map(graph.nodes.map((n) => [n.id, representative(n.id, parent, isExpanded)]));

  const children: Record<string, string[]> = {};
  for (const n of graph.nodes) {
    const p = parent.get(n.id);
    if (p) (children[p] ??= []).push(n.id);
  }

  const groups = new Map<string, { source: string; target: string; label: string; edges: GraphEdge[]; lifted: boolean }>();
  for (const e of graph.edges) {
    const source = rep.get(e.source) ?? e.source;
    const target = rep.get(e.target) ?? e.target;
    const lifted = source !== e.source || target !== e.target;
    if (source === target || (lifted && dropLiftedLabels.includes(e.label))) continue;
    const key = `${source}\u0000${target}\u0000${e.label}`;
    const group = groups.get(key) ?? { source, target, label: e.label, edges: [], lifted: false };
    group.edges.push(e);
    group.lifted ||= lifted;
    groups.set(key, group);
  }

  return {
    nodes: graph.nodes.filter((n) => rep.get(n.id) === n.id),
    // uma ligação que não mudou e não se juntou a outra sai tal como entrou
    edges: [...groups.values()].map((g) => (g.edges.length === 1 && !g.lifted ? g.edges[0] : mergeEdges(g.source, g.target, g.label, g.edges))),
    children,
  };
}

export const overviewView = (graph: DfdGraph): GraphView => project(graph);
export const detailView = (graph: DfdGraph): GraphView => project(graph, { expanded: "all", dropLiftedLabels: [] });

/**
 * Junta componentes (overview) ao grafo de detalhe: cada processo do detalhe fica com `parent` igual ao componente
 * cujo `path` é o prefixo mais longo do seu. "." (a raiz do repositório) fica com tudo o que nenhum outro reclama.
 * Um componente com o mesmo id de um processo do detalhe é esse processo: continua a servir de pai aos de baixo, mas
 * não se duplica e o do detalhe é o que fica (a fusão de confiança e evidência vem com o produtor do overview).
 */
export function assignParents(detail: DfdGraph, components: GraphNode[]): DfdGraph {
  const detailIds = new Set(detail.nodes.map((n) => n.id));
  const candidates = components.filter((c) => c.kind === "process" && typeof c.path === "string");
  const added = candidates.filter((c) => !detailIds.has(c.id));
  const claims = (component: string, path: string) => component === "." || path === component || path.startsWith(`${component}/`);
  const weight = (path: string) => (path === "." ? 0 : path.length);

  // `strict`: entre componentes, um com o mesmo path não é pai (evita que dois se escolham um ao outro)
  const parentFor = (path: string, self: string | null, strict: boolean): GraphNode | undefined => {
    let best: GraphNode | undefined;
    for (const c of candidates) {
      const componentPath = c.path as string;
      if (c.id === self || (strict && componentPath === path) || !claims(componentPath, path)) continue;
      if (!best || weight(componentPath) > weight(best.path as string)) best = c;
    }
    return best;
  };
  const adopt = (n: GraphNode, strict: boolean): GraphNode => {
    if (n.kind !== "process" || typeof n.path !== "string" || n.parent) return n;
    const found = parentFor(n.path, n.id, strict);
    return found ? { ...n, parent: found.id } : n;
  };

  return { ...detail, nodes: [...added.map((c) => adopt(c, true)), ...detail.nodes.map((n) => adopt(n, false))] };
}
