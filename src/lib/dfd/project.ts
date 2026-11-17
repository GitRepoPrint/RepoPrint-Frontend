// Vistas do grafo DFD (docs/dfd-schema.md, "Views are projections").
// Uma vista é uma função sobre o grafo, não uma segunda análise:
//   overview = nada expandido; detalhe = tudo expandido; expandir um componente mostra os seus filhos.
// Os componentes e os filhos vêm do campo `parent` (ver assignParents).
import { GENERIC_TECHNOLOGIES } from "./catalog";
import { mergeProvenance } from "./provenance";
import type { DfdGraph, GraphEdge, GraphNode } from "./schema";

/** Ligações que dizem "este código importa aquele", não "dados fluem para ali". Ao subir para um componente, caem. */
export const CODE_DEPENDENCY_LABELS: readonly string[] = ["imports"];

const MAX_LIST = 10;
const MAX_ROUTES = 20;

// Etiquetas que dizem "há acesso" sem dizer de que tipo, e as mais precisas que as substituem quando existem para o mesmo par.
// O overview só sabe que um serviço usa uma base de dados ("reads/writes"); o detalhe sabe se lê ou se escreve.
// "depends on" (um serviço espera por outro ao arrancar) é a prova mais fraca de todas: cede a qualquer outra ligação do par.
const YIELDS_TO_ANY = new Set(["depends on"]);
const MORE_PRECISE = new Map<string, readonly string[]>([
  ["reads/writes", ["reads", "writes"]],
  ["accesses", ["reads", "writes", "reads/writes"]],
  ["publishes/consumes", ["publishes", "consumes"]],
]);

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
  /** Uma ligação vaga ("reads/writes") some quando há uma precisa ("reads") para o mesmo par. Por defeito sim. */
  foldVagueLabels?: boolean;
  /**
   * Um cliente HTTP genérico ("HTTP API") não diz com quem se fala: só interessa saber que parte do código o usa. Por
   * defeito só se vê para as partes de um componente aberto; ao nível dos componentes (e na vista de detalhe, que o desliga)
   * a ligação cai e o nó some se já nada à vista lhe chegar.
   */
  hideGenericClients?: boolean;
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

/** Junta ligações com a mesma origem, destino e etiqueta numa só: somam-se as contagens e juntam-se as provas. */
export function mergeEdgeGroup(source: string, target: string, label: string, group: GraphEdge[]): GraphEdge {
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
    provenance: group.map((e) => e.provenance).reduce((a, b) => mergeProvenance(a, b)),
    extra,
  };
}

/** Uma ligação vaga ("reads/writes") some quando, para o mesmo par, há ligações precisas ("reads", "writes"): passam a levar as suas provas. */
function foldVague(edges: GraphEdge[]): GraphEdge[] {
  const byPair = new Map<string, GraphEdge[]>();
  for (const e of edges) byPair.set(`${e.source}\u0000${e.target}`, [...(byPair.get(`${e.source}\u0000${e.target}`) ?? []), e]);
  const replaced = new Map<GraphEdge, GraphEdge>();
  const dropped = new Set<GraphEdge>();
  for (const pair of byPair.values()) {
    for (const vague of pair) {
      const precise = pair.filter((e) => (YIELDS_TO_ANY.has(vague.label) ? e !== vague && !YIELDS_TO_ANY.has(e.label) : MORE_PRECISE.get(vague.label)?.includes(e.label)));
      if (!precise.length) continue;
      dropped.add(vague);
      for (const e of precise) replaced.set(e, { ...(replaced.get(e) ?? e), provenance: mergeProvenance((replaced.get(e) ?? e).provenance, vague.provenance) });
    }
  }
  return edges.filter((e) => !dropped.has(e)).map((e) => replaced.get(e) ?? e);
}

export function project(graph: DfdGraph, options: ProjectOptions = {}): GraphView {
  const { expanded = new Set<string>(), dropLiftedLabels = CODE_DEPENDENCY_LABELS, foldVagueLabels = true, hideGenericClients = true } = options;
  const isGeneric = (id: string) => GENERIC_TECHNOLOGIES.has(byId.get(id)?.technology ?? "");
  const isExpanded = expanded === "all" ? () => true : (id: string) => expanded.has(id);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
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
    if (hideGenericClients && isGeneric(e.target) && (lifted || !parent.has(e.source))) continue;
    const key = `${source}\u0000${target}\u0000${e.label}`;
    const group = groups.get(key) ?? { source, target, label: e.label, edges: [], lifted: false };
    group.edges.push(e);
    group.lifted ||= lifted;
    groups.set(key, group);
  }

  const edges = ((merged) => (foldVagueLabels ? foldVague(merged) : merged))(
    [...groups.values()].map((g) => (g.edges.length === 1 && !g.lifted ? g.edges[0] : mergeEdgeGroup(g.source, g.target, g.label, g.edges))),
  );
  // Um nó genérico que ficou sem nenhuma ligação à vista não diz nada: sai
  const referenced = new Set(edges.flatMap((e) => [e.source, e.target]));
  return {
    nodes: graph.nodes.filter((n) => rep.get(n.id) === n.id && !(hideGenericClients && isGeneric(n.id) && !referenced.has(n.id))),
    // uma ligação que não mudou e não se juntou a outra sai tal como entrou
    edges,
    children,
  };
}

export const overviewView = (graph: DfdGraph): GraphView => project(graph);
export const detailView = (graph: DfdGraph): GraphView =>
  project(graph, { expanded: "all", dropLiftedLabels: [], foldVagueLabels: false, hideGenericClients: false });

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
  // As pastas do detalhe também contêm as que estão dentro delas (src/flask/json dentro de src/flask), por isso abrir um
  // componente mostra o primeiro nível e não todas as pastas de uma vez. A raiz (".") não contém nada: é só uma pasta com ficheiros.
  const componentIds = new Set(candidates.map((c) => c.id));
  const folders = detail.nodes.filter((n) => n.kind === "process" && typeof n.path === "string" && n.path !== "." && !componentIds.has(n.id));
  const claims = (component: string, path: string) => component === "." || path === component || path.startsWith(`${component}/`);
  const weight = (path: string) => (path === "." ? 0 : path.length);

  // `strict`: um componente não é pai de outro com o mesmo caminho (evita que dois se escolham um ao outro).
  // `withFolders`: as pastas do detalhe também podem ser pai, mas só de um caminho mais fundo que o delas.
  const parentFor = (path: string, self: string | null, strict: boolean, withFolders: boolean): GraphNode | undefined => {
    let best: GraphNode | undefined;
    const consider = (c: GraphNode, mustBeShorter: boolean) => {
      const candidatePath = c.path as string;
      if (c.id === self || ((strict || mustBeShorter) && candidatePath === path) || !claims(candidatePath, path)) return;
      if (!best || weight(candidatePath) > weight(best.path as string)) best = c;
    };
    for (const c of candidates) consider(c, false); // os componentes primeiro: num empate ganham eles
    if (withFolders) for (const f of folders) consider(f, true);
    return best;
  };
  const adopt = (n: GraphNode, isDetail: boolean): GraphNode => {
    if (n.kind !== "process" || typeof n.path !== "string" || n.parent) return n;
    const found = parentFor(n.path, n.id, !isDetail, isDetail);
    return found ? { ...n, parent: found.id } : n;
  };

  return { ...detail, nodes: [...added.map((c) => adopt(c, false)), ...detail.nodes.map((n) => adopt(n, true))] };
}
