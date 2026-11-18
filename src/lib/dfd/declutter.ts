// Menos linhas, e as que ficam a dizer mais. Um diagrama de código tem muitas ligações "importa" (esta pasta usa aquela) e poucas de
// dados a sério (lê, escreve, chama, pedidos HTTP). Desenhadas todas com o mesmo peso e uma legenda cada, as primeiras escondem as
// segundas. Aqui:
//   - declutterEdges tira o que não acrescenta nada (uma dependência que um caminho mais comprido já implica; duas setas entre os
//     mesmos dois componentes passam a uma linha com duas pontas);
//   - edgeKind / edgeStyle separam o que é dependência (fina, tracejada, sem legenda) do que é fluxo de dados (firme, com legenda);
//   - markEdges diz que linhas tocam no que está selecionado, para as outras esmaecerem.
// Nenhuma muda o que a análise encontrou: o que se deixa de desenhar é sempre alcançável pelas linhas que ficam.
import type { GraphView } from "./project";
import type { GraphEdge } from "./schema";

export type EdgeKind = "flow" | "dependency";
export type EdgeState = "normal" | "active" | "dim";

/** "imports" diz só que um código usa outro; todo o resto (lê, escreve, chama, pedidos HTTP, depende de) é dados ou controlo a fluir. */
export const edgeKind = (label: string): EdgeKind => (label.trim().toLowerCase() === "imports" ? "dependency" : "flow");

const pairKey = (source: string, target: string) => `${source}\u0000${target}`;

/**
 * As ligações de uma vista, sem as que não acrescentam nada:
 *  1. uma dependência entre dois componentes que também têm uma ligação de dados entre eles (a de dados diz mais);
 *  2. duas dependências em sentidos opostos entre os mesmos dois componentes ficam numa linha só, com setas nos dois sentidos
 *     (`extra.bidirectional`);
 *  3. uma dependência A→C que um caminho mais comprido (A→B→C) já implica (redução transitiva).
 * Uma ligação de dados nunca se tira. Quem se alcançava a partir de quem continua igual.
 */
export function declutterEdges(view: GraphView): GraphView {
  const dataPairs = new Set(view.edges.filter((e) => edgeKind(e.label) === "flow").map((e) => pairKey(e.source, e.target)));

  // 1. e as ligações de um componente a si próprio, que não dizem nada
  let edges = view.edges.filter((e) => e.source !== e.target && !(edgeKind(e.label) === "dependency" && dataPairs.has(pairKey(e.source, e.target))));

  // 2. dependências nos dois sentidos -> uma linha com duas pontas (fica a do sentido que vem primeiro por ordem alfabética)
  const dependencies = new Set(edges.filter((e) => edgeKind(e.label) === "dependency").map((e) => pairKey(e.source, e.target)));
  const merged = new Set<string>();
  const next: GraphEdge[] = [];
  for (const e of edges) {
    const reverse = pairKey(e.target, e.source);
    if (edgeKind(e.label) === "dependency" && dependencies.has(reverse)) {
      if (e.source > e.target) continue; // a do sentido contrário já a representa
      next.push({ ...e, extra: { ...e.extra, bidirectional: true } });
      merged.add(e.id);
    } else {
      next.push(e);
    }
  }
  edges = next;

  // 3. redução transitiva das dependências (as que acabam de se juntar nos dois sentidos não se tiram)
  const adjacency = new Map<string, { id: string; to: string }[]>();
  const connect = (id: string, from: string, to: string) => (adjacency.get(from) ?? adjacency.set(from, []).get(from)!).push({ id, to });
  for (const e of edges) {
    connect(e.id, e.source, e.target);
    if (e.extra?.bidirectional) connect(`${e.id}~`, e.target, e.source);
  }
  const reaches = (from: string, to: string, skipId: string) => {
    const seen = new Set([from]);
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      for (const { id, to: next } of adjacency.get(queue[i]) ?? []) {
        if (id === skipId || seen.has(next)) continue;
        if (next === to) return true;
        seen.add(next);
        queue.push(next);
      }
    }
    return false;
  };
  const removed = new Set<string>();
  const candidates = edges.filter((e) => edgeKind(e.label) === "dependency" && !e.extra?.bidirectional).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const e of candidates) {
    if (!reaches(e.source, e.target, e.id)) continue;
    removed.add(e.id);
    adjacency.set(e.source, (adjacency.get(e.source) ?? []).filter((link) => link.id !== e.id));
  }

  return { ...view, edges: edges.filter((e) => !removed.has(e.id)) };
}

export interface EdgeLook {
  width: number;
  opacity: number;
  /** stroke-dasharray; sem ele, linha contínua. */
  dash?: string;
  showLabel: boolean;
}

/** Como se desenha uma ligação. Dependências finas e a tracejado, sem legenda; fluxos firmes, com legenda; a seleção realça e esmaece o resto. */
export function edgeStyle(kind: EdgeKind, state: EdgeState): EdgeLook {
  if (kind === "dependency") {
    if (state === "active") return { width: 2, opacity: 1, dash: "5 5", showLabel: true };
    if (state === "dim") return { width: 1, opacity: 0.3, dash: "5 5", showLabel: false };
    return { width: 1.25, opacity: 0.6, dash: "5 5", showLabel: false };
  }
  if (state === "active") return { width: 3, opacity: 1, showLabel: true };
  if (state === "dim") return { width: 1.5, opacity: 0.45, showLabel: false };
  return { width: 2, opacity: 1, showLabel: true };
}

/**
 * Para cada ligação, se está em destaque (toca num componente selecionado, ou é ela a selecionada), esmaecida (há seleção e
 * não toca nela) ou normal (não há seleção nenhuma).
 */
export function markEdges<T extends { id: string; source: string; target: string }>(
  edges: T[],
  selectedNodes: ReadonlySet<string>,
  selectedEdges: ReadonlySet<string> = new Set(),
): (T & { state: EdgeState })[] {
  const any = selectedNodes.size > 0 || selectedEdges.size > 0;
  return edges.map((e) => ({
    ...e,
    state: !any ? "normal" : selectedEdges.has(e.id) || selectedNodes.has(e.source) || selectedNodes.has(e.target) ? "active" : "dim",
  }));
}
