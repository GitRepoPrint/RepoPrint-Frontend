// O que se mostra de um diagrama grande para que se consiga ler. São duas coisas diferentes:
//
//  1. A PRÉVIA do dashboard: no máximo OVERVIEW_MAX_NODES (10) componentes, menos se houver menos que valha a pena mostrar.
//     É um resumo, por isso o limite é imposto (overviewIds).
//  2. A VISTA COMPLETA (canvas): sem limite. O "fluxo principal" é o que o diagrama diz que é, seja quanto for (flowIds);
//     também se pode escolher componentes à mão ou ver o diagrama inteiro. O diagrama inteiro encurta-se de duas maneiras
//     (withoutAuxiliary aqui e expandToDepth em project.ts): sem testes/documentação/exemplos, e com as pastas fundas
//     dobradas no pai.
//
// Tudo isto são funções sobre o grafo ou a vista, como o resto de lib/dfd: nenhuma muda o que a análise encontrou.
import { declutterEdges } from "./declutter";
import type { GraphView } from "./project";
import type { DfdGraph, GraphEdge, GraphNode, GraphNodeKind } from "./schema";

/** O máximo de componentes da prévia do dashboard. */
export const OVERVIEW_MAX_NODES = 10;
/** Na prévia, no máximo estes sítios de fora encontrados em endereços do código (sem tecnologia conhecida): são o que mais enche um resumo. */
const OVERVIEW_MAX_HOSTS = 3;
/** Se o fluxo de dados não se consegue determinar (nada toca em dados), mostram-se os componentes mais ligados, até este número. */
const FALLBACK_NODES = 10;

export type FocusMode = "main" | "pick" | "all";
export type FocusSort = "importance" | "name" | "kind";

export const ALL_KINDS: readonly GraphNodeKind[] = ["process", "data_store", "external_entity"];

export interface FocusOptions {
  mode: FocusMode;
  /** Os componentes escolhidos (modo pick). */
  picked?: readonly string[];
  /** Tipos de componente à vista; por defeito todos. */
  kinds?: ReadonlySet<GraphNodeKind>;
  /** Componentes que têm de aparecer (o selecionado). */
  pinned?: readonly string[];
  /** Componentes que entram no fluxo principal mesmo fora dele (as partes de um componente que o utilizador abriu). */
  boost?: ReadonlySet<string>;
}

export interface FocusResult {
  view: GraphView;
  /** Quantos componentes tem a vista antes do foco. */
  total: number;
  shown: number;
}

export interface NodeRow {
  id: string;
  name: string;
  kind: GraphNodeKind;
  /** Ligações que entram ou saem do componente (na vista). */
  connections: number;
  score: number;
}

// ---------------------------------------------------------------------------------------------------------------------
// Testes, documentação, exemplos e scripts

// Existem em quase todos os repositórios, mas não são o fluxo de dados do produto. Num repositório grande são a maior parte
// das pastas (o FastAPI tem mais de 100 pastas só de tutoriais de documentação).
const AUXILIARY_SEGMENT = /^(tests?|__tests__|test_.*|.*_tests?|e2e|specs?|docs?|docs_src|documentation|examples?|samples?|demos?|scripts?|benchmarks?|fixtures?|mocks?|tools?|tutorials?)$/i;

/** Uma pasta de testes, documentação, exemplos ou scripts (por qualquer parte do caminho). */
export function isAuxiliary(node: GraphNode): boolean {
  if (node.kind !== "process") return false;
  const where = node.path && node.path !== "." ? node.path : node.name;
  return where.split("/").some((segment) => AUXILIARY_SEGMENT.test(segment));
}

/**
 * O grafo sem as pastas de testes, documentação, exemplos e scripts, e sem o que só elas usavam (um CDN que só aparece num
 * modelo de documentação, uma base de dados que só um teste abre). Só toca no que veio da análise do código: um serviço do
 * docker-compose chamado "docs" é um serviço a sério e fica. Se não sobrasse nenhum componente, devolve o grafo como está
 * (um repositório que é só documentação continua a ter diagrama).
 */
export function withoutAuxiliary(graph: DfdGraph): DfdGraph {
  const drop = new Set(graph.nodes.filter((n) => n.provenance.source === "code" && isAuxiliary(n)).map((n) => n.id));
  if (!drop.size) return graph;

  const hadEdge = new Set(graph.edges.flatMap((e) => [e.source, e.target]));
  const edges = graph.edges.filter((e) => !drop.has(e.source) && !drop.has(e.target));
  const stillUsed = new Set(edges.flatMap((e) => [e.source, e.target]));
  const nodes = graph.nodes
    .filter((n) => !drop.has(n.id) && (n.kind === "process" || stillUsed.has(n.id) || !hadEdge.has(n.id)))
    .map((n) => (n.parent && drop.has(n.parent) ? { ...n, parent: null } : n));
  if (!nodes.some((n) => n.kind === "process")) return graph;
  return { ...graph, nodes, edges };
}

// ---------------------------------------------------------------------------------------------------------------------
// Pontuação: quanto cada componente importa para o fluxo de dados

// Uma ligação "imports" diz só que uma pasta usa outra; as restantes (lê, escreve, chama, pedidos HTTP) são dados a fluir.
const IMPORT_WEIGHT = 1;
const FLOW_WEIGHT = 3;
// Onde os dados entram e onde ficam: o cliente, as bases de dados e os sistemas de fora contam mais do que mais uma pasta.
const CLIENT_BONUS = 8;
const STORE_BONUS = 5;
const EXTERNAL_BONUS = 2;
const AUXILIARY_PENALTY = 60;
const BOOST = 1000;

const isClient = (n: GraphNode) => n.kind === "external_entity" && Boolean(n.tags?.includes("client"));
/** Onde os dados ficam ou vão parar: bases de dados e sistemas de fora (o cliente é de onde vêm, não para onde vão). */
const isSink = (n: GraphNode) => n.kind === "data_store" || (n.kind === "external_entity" && !isClient(n));

function kindBonus(node: GraphNode): number {
  if (node.kind === "data_store") return STORE_BONUS;
  if (node.kind === "external_entity") return isClient(node) ? CLIENT_BONUS : EXTERNAL_BONUS;
  return 0;
}

/** Quanto cada componente importa: ligações que não são imports pesam mais, o tipo conta, e testes e documentação descem. */
export function scoreNodes(view: GraphView): Map<string, NodeRow> {
  const rows = new Map<string, NodeRow>();
  for (const n of view.nodes) rows.set(n.id, { id: n.id, name: n.name, kind: n.kind, connections: 0, score: kindBonus(n) - (isAuxiliary(n) ? AUXILIARY_PENALTY : 0) });
  for (const e of view.edges) {
    const weight = e.label === "imports" ? IMPORT_WEIGHT : FLOW_WEIGHT;
    for (const end of [e.source, e.target]) {
      const row = rows.get(end);
      if (!row) continue;
      row.connections += 1;
      row.score += weight;
    }
  }
  return rows;
}

const byScore = (a: NodeRow, b: NodeRow) => b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

// ---------------------------------------------------------------------------------------------------------------------
// O fluxo principal

/** Alcança-se a partir de `from` seguindo as ligações (para a frente, ou para trás se `reverse`), só entre os nós de `allowed`. */
function reach(from: Iterable<string>, edges: GraphEdge[], allowed: ReadonlySet<string>, reverse: boolean): Set<string> {
  const next = new Map<string, string[]>();
  for (const e of edges) {
    const [a, b] = reverse ? [e.target, e.source] : [e.source, e.target];
    if (allowed.has(a) && allowed.has(b)) (next.get(a) ?? next.set(a, []).get(a)!).push(b);
  }
  const queue = [...from].filter((id) => allowed.has(id));
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    for (const id of next.get(queue[i]) ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    }
  }
  return seen;
}

/**
 * Os componentes por onde passam os dados do produto, sem limite de quantos. Define-se pelo caminho que os dados fazem:
 *
 *  - entradas: o código que recebe pedidos do cliente;
 *  - destinos: as bases de dados e os sistemas de fora (e o código que lhes toca);
 *  - o fluxo principal é tudo o que está num caminho de uma entrada até um destino, mais as próprias entradas e destinos.
 *
 * Fica de fora o que não está em nenhum desses caminhos (utilitários, configuração, modelos) e os testes, documentação,
 * exemplos e scripts. Sem entradas (uma biblioteca, uma ferramenta), é o código que toca em dados. Se nada toca em dados,
 * não há fluxo para mostrar e cai-se nos componentes mais ligados (até FALLBACK_NODES). Um diagrama com 10 componentes ou
 * menos mostra-se inteiro: não há nada a resumir.
 */
export function flowIds(view: GraphView, options: Pick<FocusOptions, "kinds" | "pinned" | "boost"> = {}): string[] {
  const kinds = options.kinds ?? new Set(ALL_KINDS);
  const known = new Set(view.nodes.filter((n) => kinds.has(n.kind)).map((n) => n.id));
  const extra = [...(options.pinned ?? []), ...(options.boost ?? [])];
  const finish = (ids: Iterable<string>) => [...new Set([...ids, ...extra])].filter((id) => known.has(id));

  if (view.nodes.length <= OVERVIEW_MAX_NODES) return finish(view.nodes.map((n) => n.id));

  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const product = new Set(view.nodes.filter((n) => !isAuxiliary(n)).map((n) => n.id));
  const edges = view.edges.filter((e) => product.has(e.source) && product.has(e.target));
  const processes = new Set([...product].filter((id) => byId.get(id)!.kind === "process"));

  const entries = new Set<string>();
  const touching = new Set<string>();
  for (const e of edges) {
    if (isClient(byId.get(e.source)!) && processes.has(e.target)) entries.add(e.target);
    if (processes.has(e.source) && isSink(byId.get(e.target)!)) touching.add(e.source);
  }

  const onPath = new Set<string>([...entries, ...touching]);
  if (entries.size && touching.size) {
    const forward = reach(entries, edges, processes, false);
    const backward = reach(touching, edges, processes, true);
    for (const id of forward) if (backward.has(id)) onPath.add(id);
  }

  if (!onPath.size) return finish(growIds(view, [...product], FALLBACK_NODES, {}));

  const flow = new Set(onPath);
  for (const e of edges) {
    if (onPath.has(e.source) && isSink(byId.get(e.target)!)) flow.add(e.target);
    if (isClient(byId.get(e.source)!) && entries.has(e.target)) flow.add(e.source);
  }
  return finish(flow);
}

/**
 * Até `max` componentes de `pool`: começa no mais importante e vai juntando o mais importante dos que se ligam ao que já lá
 * está, por isso o resultado é um bocado ligado do diagrama e não dez peças soltas. Só salta para um componente sem ligação
 * quando já não há mais nenhum ligado. Os `boost` ganham prioridade (as partes de um componente aberto).
 */
export function growIds(view: GraphView, pool: readonly string[], max: number, options: Pick<FocusOptions, "pinned" | "boost">): string[] {
  const inPool = new Set(pool);
  const rows = scoreNodes(view);
  const ranked = [...inPool].map((id) => rows.get(id)).filter((r): r is NodeRow => Boolean(r));
  for (const row of ranked) if (options.boost?.has(row.id)) row.score += BOOST;
  ranked.sort(byScore);

  const neighbours = new Map<string, Set<string>>();
  for (const e of view.edges) {
    if (!inPool.has(e.source) || !inPool.has(e.target) || e.source === e.target) continue;
    (neighbours.get(e.source) ?? neighbours.set(e.source, new Set()).get(e.source)!).add(e.target);
    (neighbours.get(e.target) ?? neighbours.set(e.target, new Set()).get(e.target)!).add(e.source);
  }

  const chosen: string[] = [];
  const chosenSet = new Set<string>();
  const frontier = new Set<string>();
  const add = (id: string) => {
    chosen.push(id);
    chosenSet.add(id);
    frontier.delete(id);
    for (const next of neighbours.get(id) ?? []) if (!chosenSet.has(next)) frontier.add(next);
  };
  const best = (ids: Iterable<string>) => {
    let top: NodeRow | undefined;
    for (const id of ids) {
      const row = rows.get(id);
      if (!row || chosenSet.has(id)) continue;
      if (!top || byScore(row, top) < 0) top = row;
    }
    return top;
  };

  for (const id of options.pinned ?? []) if (inPool.has(id) && !chosenSet.has(id) && chosen.length < max) add(id);
  while (chosen.length < max && chosen.length < ranked.length) {
    const next = best(frontier) ?? best(ranked.map((r) => r.id));
    if (!next) break;
    add(next.id);
  }
  return chosen;
}

/**
 * Um sítio de fora que só se conhece por aparecer num endereço do código (fonts.googleapis.com, spdx.dev): não tem tecnologia
 * conhecida, ao contrário de uma base de dados ou de um serviço do catálogo. Num repositório que cita dezenas de sítios, enchem o
 * resumo; ficam os OVERVIEW_MAX_HOSTS mais ligados (e o que o utilizador escolheu ou abriu).
 */
function withFewerHosts(view: GraphView, flow: string[], keep: ReadonlySet<string>): string[] {
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const rows = scoreNodes(view);
  const isHost = (id: string) => {
    const n = byId.get(id);
    return Boolean(n && n.kind === "external_entity" && !isClient(n) && !n.technology);
  };
  const hosts = flow.filter((id) => isHost(id) && !keep.has(id)).sort((a, b) => byScore(rows.get(a)!, rows.get(b)!));
  const dropped = new Set(hosts.slice(OVERVIEW_MAX_HOSTS));
  return flow.filter((id) => !dropped.has(id));
}

/**
 * A prévia do dashboard: o fluxo principal e, se tiver mais de `max` componentes, os `max` mais importantes dele (ligados
 * entre si). Nunca devolve mais de `max`. Se o fluxo for mais pequeno, é esse o tamanho da prévia.
 */
export function overviewIds(view: GraphView, options: { max?: number; boost?: ReadonlySet<string> } = {}): string[] {
  const max = options.max ?? OVERVIEW_MAX_NODES;
  // Só o que o utilizador abriu (boost) muda a prévia. Selecionar um componente não a muda: só se seleciona o que já se vê.
  let flow = flowIds(view, { boost: options.boost });
  if (view.nodes.length > OVERVIEW_MAX_NODES) flow = withFewerHosts(view, flow, new Set(options.boost ?? []));
  return flow.length <= max ? flow : growIds(view, flow, max, { boost: options.boost });
}

// ---------------------------------------------------------------------------------------------------------------------
// Aplicar

function restrict(view: GraphView, ids: ReadonlySet<string>): GraphView {
  return { nodes: view.nodes.filter((n) => ids.has(n.id)), edges: view.edges.filter((e) => ids.has(e.source) && ids.has(e.target)), children: view.children };
}

/** A prévia do dashboard (no máximo `max` componentes). */
export function applyOverview(view: GraphView, options: { max?: number; boost?: ReadonlySet<string> } = {}): FocusResult {
  const ids = new Set(overviewIds(view, options));
  return { view: declutterEdges(restrict(view, ids)), total: view.nodes.length, shown: ids.size };
}

/** A vista completa (canvas): o fluxo principal, os componentes escolhidos ou tudo. Sem limite de componentes. */
export function applyFocus(view: GraphView, options: FocusOptions): FocusResult {
  const total = view.nodes.length;
  const kinds = options.kinds ?? new Set(ALL_KINDS);
  let ids: Set<string>;
  if (options.mode === "all") ids = new Set(view.nodes.filter((n) => kinds.has(n.kind)).map((n) => n.id));
  else if (options.mode === "pick") {
    const existing = new Set(view.nodes.map((n) => n.id));
    ids = new Set((options.picked ?? []).filter((id) => existing.has(id)));
  } else ids = new Set(flowIds(view, { kinds, pinned: options.pinned, boost: options.boost }));
  return { view: declutterEdges(restrict(view, ids)), total, shown: ids.size };
}

/** A lista para escolher componentes: filtrada por tipo e por texto, e ordenada. */
export function listNodes(
  view: GraphView,
  options: { kinds?: ReadonlySet<GraphNodeKind>; query?: string; sort?: FocusSort } = {},
): NodeRow[] {
  const { kinds = new Set(ALL_KINDS), query = "", sort = "importance" } = options;
  const needle = query.trim().toLowerCase();
  const rows = scoreNodes(view);
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const matches = [...rows.values()].filter((r) => {
    if (!kinds.has(r.kind)) return false;
    if (!needle) return true;
    const node = byId.get(r.id)!;
    return [r.name, node.path ?? "", node.technology ?? ""].some((text) => text.toLowerCase().includes(needle));
  });
  const kindOrder = new Map(ALL_KINDS.map((k, i) => [k, i]));
  const compare: Record<FocusSort, (a: NodeRow, b: NodeRow) => number> = {
    importance: byScore,
    name: (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    kind: (a, b) => kindOrder.get(a.kind)! - kindOrder.get(b.kind)! || byScore(a, b),
  };
  return matches.sort(compare[sort]);
}
