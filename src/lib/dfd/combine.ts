// Junta o overview (configuração, no navegador) e o detalhe (código, no backend) num só grafo, como diz
// docs/dfd-schema.md ("Combining overview and detail"). Os dois produtores não dependem um do outro: esta função pura é
// que os junta, no cliente.
//
//  1. Nós com o mesmo id são o mesmo nó: juntam-se (maior confiança, evidências somadas, o nome do overview).
//  2. Um depósito sem nome ("data_store:postgresql", achado por um import) junta-se ao único depósito com nome da mesma
//     tecnologia ("data_store:db", um serviço do compose). Com vários não se sabe qual: fica à parte. O vago "SQL database" (um ORM)
//     junta-se à única base de dados SQL; "Message queue" (celery) à única fila.
//  3. Cada processo do detalhe fica com `parent` igual ao componente do overview cujo caminho é o seu prefixo mais longo.
//  4. As ligações juntam-se por (origem, destino, etiqueta), depois de apontadas para os nós que sobraram.
//  Se um diz uma coisa e o outro não, ficam as duas: nada se deita fora em silêncio.
import { SQL_DATABASES } from "./catalog";
import { assignParents, mergeEdgeGroup } from "./project";
import { mergeProvenance } from "./provenance";
import type { DfdGraph, GraphEdge, GraphNode } from "./schema";

// Sem nome: achado por um import ou por uma dependência. Um depósito que o compose declara tem nome, mesmo que se chame como a tecnologia.
const isAnonymousStore = (n: GraphNode) => n.kind === "data_store" && !!n.technology && n.id === `data_store:${n.technology}` && !n.extra?.composeService;
const isComponent = (n: GraphNode) => n.kind === "process" && typeof n.path === "string";

/** `primary` manda no nome, no caminho e na tecnologia; as provas somam-se. */
function mergeNode(primary: GraphNode, other: GraphNode): GraphNode {
  const sources = [...new Set([primary.provenance.source, other.provenance.source])];
  return {
    ...primary,
    technology: primary.technology ?? other.technology ?? null,
    tags: [...new Set([...(primary.tags ?? []), ...(other.tags ?? [])])],
    parent: primary.parent ?? other.parent ?? null,
    path: primary.path ?? other.path ?? null,
    provenance: mergeProvenance(primary.provenance, other.provenance),
    extra: { ...other.extra, ...primary.extra, ...(sources.length > 1 ? { sources } : {}) },
  };
}

const remap = (id: unknown, redirect: Map<string, string>) => (typeof id === "string" ? (redirect.get(id) ?? id) : id);

/** Os "flows" do detalhe (rota -> recursos) apontam para ids de nós: os que se juntaram a outro têm de apontar para o novo. */
function remapFlows(extra: Record<string, unknown> | undefined, redirect: Map<string, string>): Record<string, unknown> | undefined {
  if (!extra || !Array.isArray(extra.flows) || redirect.size === 0) return extra;
  const flows = (extra.flows as Record<string, unknown>[]).map((flow) => ({
    ...flow,
    process: remap(flow.process, redirect),
    resources: Array.isArray(flow.resources)
      ? (flow.resources as Record<string, unknown>[]).map((r) => ({
          ...r,
          id: remap(r.id, redirect),
          path: Array.isArray(r.path) ? r.path.map((step) => remap(step, redirect)) : r.path,
        }))
      : flow.resources,
  }));
  return { ...extra, flows };
}

export function combineGraphs(overview: DfdGraph, detail: DfdGraph, now?: string): DfdGraph {
  // ---- 1. Nós com o mesmo id
  const nodes = new Map<string, GraphNode>(detail.nodes.map((n) => [n.id, n]));
  const overviewOnly = new Set<string>();
  for (const n of overview.nodes) {
    const same = nodes.get(n.id);
    if (same) nodes.set(n.id, mergeNode(n, same));
    else {
      nodes.set(n.id, n);
      overviewOnly.add(n.id);
    }
  }

  // ---- 2. Depósitos sem nome
  const redirect = new Map<string, string>();
  const stores = () => [...nodes.values()].filter((n) => n.kind === "data_store");
  const fold = (vague: GraphNode, into: GraphNode) => {
    nodes.set(into.id, mergeNode(into, vague));
    nodes.delete(vague.id);
    redirect.set(vague.id, into.id);
  };
  for (const anonymous of stores().filter(isAnonymousStore)) {
    const instances = stores().filter((n) => !isAnonymousStore(n) && n.technology === anonymous.technology);
    if (instances.length === 1) fold(anonymous, instances[0]);
  }
  for (const vague of stores()) {
    const candidates =
      vague.id === "data_store:sql-database" ? stores().filter((n) => n.id !== vague.id && SQL_DATABASES.has(n.technology ?? ""))
      : vague.id === "data_store:message-queue" ? stores().filter((n) => n.id !== vague.id && n.tags?.includes("queue"))
      : [];
    if (candidates.length === 1) fold(vague, candidates[0]);
  }

  // ---- 3. Pais: os componentes do overview contêm os processos do detalhe que moram dentro do seu caminho
  const components = overview.nodes.filter(isComponent);
  const base = [...nodes.values()].filter((n) => !(overviewOnly.has(n.id) && isComponent(n)));
  const joined = assignParents({ ...detail, nodes: base }, components);

  // ---- 4. Ligações
  const groups = new Map<string, { source: string; target: string; label: string; edges: GraphEdge[]; changed: boolean }>();
  for (const e of [...overview.edges, ...detail.edges]) {
    const source = redirect.get(e.source) ?? e.source;
    const target = redirect.get(e.target) ?? e.target;
    if (source === target) continue;
    const key = `${source}\u0000${target}\u0000${e.label}`;
    const group = groups.get(key) ?? { source, target, label: e.label, edges: [], changed: false };
    group.edges.push(e);
    group.changed ||= source !== e.source || target !== e.target;
    groups.set(key, group);
  }
  const edges = [...groups.values()].map((g) => (g.edges.length === 1 && !g.changed ? g.edges[0] : mergeEdgeGroup(g.source, g.target, g.label, g.edges)));

  return {
    schema_version: "1",
    repository: detail.repository,
    level: "detail",
    nodes: joined.nodes,
    edges,
    meta: {
      producer: "combined",
      generated_at: now ?? new Date().toISOString(),
      sources: [overview.meta.producer, detail.meta.producer],
      ...(detail.meta.group_by ? { group_by: detail.meta.group_by } : {}),
      ...(detail.meta.stats ? { stats: detail.meta.stats } : {}),
      ...(overview.meta.inputs ? { inputs: overview.meta.inputs } : {}),
      ...(overview.meta.fallback ? { fallback: overview.meta.fallback } : {}),
    },
    ...(detail.extra ? { extra: remapFlows(detail.extra, redirect) } : {}),
  };
}
