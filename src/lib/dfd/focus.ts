// "Foco" sobre uma vista do DFD: o que se mostra de um diagrama grande para que se consiga ler.
// Uma vista (project.ts) decide o que está aberto ou fechado; o foco decide quantos componentes aparecem ao mesmo tempo:
//   main = o fluxo de dados principal, com no máximo MAX_FOCUS_NODES componentes (limite imposto, não só uma sugestão);
//   pick = os componentes que o utilizador escolheu, também com esse máximo;
//   all  = o diagrama inteiro (só quando o utilizador o pede; sem limite).
// É uma função sobre a vista, como o resto de lib/dfd: não é uma segunda análise.
import type { GraphView } from "./project";
import type { GraphEdge, GraphNode, GraphNodeKind } from "./schema";

/** O máximo de componentes à vista no fluxo principal e nas escolhas. O docs/dfd-schema.md dizia "cerca de 15"; agora são 10 e cumprem-se. */
export const MAX_FOCUS_NODES = 10;

export type FocusMode = "main" | "pick" | "all";
export type FocusSort = "importance" | "name" | "kind";

export const ALL_KINDS: readonly GraphNodeKind[] = ["process", "data_store", "external_entity"];

export interface FocusOptions {
  mode: FocusMode;
  /** Os componentes escolhidos (modo pick); passados do máximo, os últimos são ignorados. */
  picked?: readonly string[];
  /** Tipos de componente à vista; por defeito todos. Estreita o fluxo principal e o diagrama inteiro. */
  kinds?: ReadonlySet<GraphNodeKind>;
  /** Componentes que têm de aparecer (o selecionado), contam para o máximo. */
  pinned?: readonly string[];
  /** Componentes que ganham prioridade no fluxo principal (as partes de um componente que o utilizador abriu). */
  boost?: ReadonlySet<string>;
  max?: number;
}

export interface FocusResult {
  view: GraphView;
  /** Quantos componentes tem a vista antes do foco. */
  total: number;
  shown: number;
  /** Em modo pick, as escolhas que passaram do máximo e ficaram de fora. */
  overflow: number;
}

export interface NodeRow {
  id: string;
  name: string;
  kind: GraphNodeKind;
  /** Ligações que entram ou saem do componente (na vista). */
  connections: number;
  score: number;
}

// Uma ligação "imports" diz só que uma pasta usa outra; as restantes (lê, escreve, chama, pedidos HTTP) são dados a fluir.
const IMPORT_WEIGHT = 1;
const FLOW_WEIGHT = 3;
// Onde os dados entram e onde ficam: o cliente, as bases de dados e os sistemas de fora contam mais do que mais uma pasta.
const KIND_BONUS = { client: 8, data_store: 5, third_party: 2, external_entity: 2, process: 0 } as const;
// Testes, documentação, exemplos e scripts de apoio existem em quase todos os repositórios, mas não são o fluxo de dados do produto:
// ficam para o fim da lista (continuam a poder ser escolhidos e aparecem se não houver mais nada).
const AUXILIARY_PENALTY = 60;
const AUXILIARY_SEGMENT = /^(tests?|__tests__|test_.*|.*_tests?|e2e|specs?|docs?|docs_src|documentation|examples?|samples?|demos?|scripts?|benchmarks?|fixtures?|mocks?|tools?|tutorials?)$/i;
const BOOST = 1000;

/** Uma pasta de testes, documentação, exemplos ou scripts (por qualquer parte do caminho). */
export function isAuxiliary(node: GraphNode): boolean {
  if (node.kind !== "process") return false;
  const where = node.path && node.path !== "." ? node.path : node.name;
  return where.split("/").some((segment) => AUXILIARY_SEGMENT.test(segment));
}

function kindBonus(node: GraphNode): number {
  if (node.kind === "data_store") return KIND_BONUS.data_store;
  if (node.kind === "external_entity") return node.tags?.includes("client") ? KIND_BONUS.client : KIND_BONUS.external_entity;
  return KIND_BONUS.process;
}

/** Quanto cada componente importa para o fluxo de dados: ligações que não são imports pesam mais, o tipo conta, e testes e documentação descem. */
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

/**
 * O fluxo principal: começa pelo componente mais importante e vai juntando o mais importante dos que se ligam ao que já lá está,
 * por isso o resultado é um bocado ligado do diagrama e não dez peças soltas. Só salta para um componente sem ligação quando
 * já não há mais nenhum ligado.
 */
export function mainFlowIds(view: GraphView, options: Pick<FocusOptions, "kinds" | "pinned" | "boost" | "max"> = {}): string[] {
  const max = options.max ?? MAX_FOCUS_NODES;
  const kinds = options.kinds ?? new Set(ALL_KINDS);
  const rows = scoreNodes(view);
  const pool = view.nodes.filter((n) => kinds.has(n.kind)).map((n) => rows.get(n.id)!);
  for (const row of pool) if (options.boost?.has(row.id)) row.score += BOOST;
  const ranked = [...pool].sort(byScore);

  const inPool = new Set(pool.map((r) => r.id));
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

  for (const id of options.pinned ?? []) if (inPool.has(id) && !chosenSet.has(id) && chosen.length < max) add(id);
  const auxiliary = new Set(view.nodes.filter(isAuxiliary).map((n) => n.id));
  const best = (ids: Iterable<string>, wantAuxiliary: boolean) => {
    let top: NodeRow | undefined;
    for (const id of ids) {
      if (auxiliary.has(id) !== wantAuxiliary || chosenSet.has(id)) continue;
      const row = rows.get(id)!;
      if (!top || byScore(row, top) < 0) top = row;
    }
    return top;
  };
  const everyone = ranked.map((r) => r.id);
  while (chosen.length < max && chosen.length < ranked.length) {
    // Primeiro o que se liga ao que já está, depois o mais importante de todos; testes e documentação só quando já não há mais nada.
    const next = best(frontier, false) ?? best(everyone, false) ?? best(frontier, true) ?? best(everyone, true);
    if (!next) break;
    add(next.id);
  }
  return chosen;
}

function restrict(view: GraphView, ids: ReadonlySet<string>): GraphView {
  const edges: GraphEdge[] = view.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes: view.nodes.filter((n) => ids.has(n.id)), edges, children: view.children };
}

/** Aplica o foco a uma vista. Nunca devolve mais de `max` componentes em main e pick; só `all` os mostra todos. */
export function applyFocus(view: GraphView, options: FocusOptions): FocusResult {
  const max = options.max ?? MAX_FOCUS_NODES;
  const total = view.nodes.length;
  const kinds = options.kinds ?? new Set(ALL_KINDS);

  if (options.mode === "all") {
    const ids = new Set(view.nodes.filter((n) => kinds.has(n.kind)).map((n) => n.id));
    return { view: restrict(view, ids), total, shown: ids.size, overflow: 0 };
  }

  if (options.mode === "pick") {
    const existing = new Set(view.nodes.map((n) => n.id));
    const wanted = [...new Set(options.picked ?? [])].filter((id) => existing.has(id));
    const ids = new Set(wanted.slice(0, max));
    return { view: restrict(view, ids), total, shown: ids.size, overflow: wanted.length - ids.size };
  }

  const ids = new Set(mainFlowIds(view, { kinds, pinned: options.pinned, boost: options.boost, max }));
  return { view: restrict(view, ids), total, shown: ids.size, overflow: 0 };
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
