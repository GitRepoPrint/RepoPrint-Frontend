import { useCallback, useMemo, useState } from "react";
import { ALL_KINDS, applyFocus, listNodes, withoutAuxiliary } from "@/lib/dfd/focus";
import type { FocusMode, FocusResult, FocusSort, NodeRow } from "@/lib/dfd/focus";
import { expandToDepth, project } from "@/lib/dfd/project";
import type { GraphView } from "@/lib/dfd/project";
import type { DfdGraph, GraphNodeKind } from "@/lib/dfd/schema";

/** Quantos níveis de pastas se mostram (1, 2, 3) ou todos. */
export type DetailLevel = 1 | 2 | 3 | "all";
export const DEFAULT_LEVELS: DetailLevel = 2;

export interface FocusState {
  mode: FocusMode;
  picked: string[];
  kinds: ReadonlySet<GraphNodeKind>;
  query: string;
  sort: FocusSort;
  levels: DetailLevel;
  /** Incluir testes, documentação, exemplos e scripts. */
  includeAuxiliary: boolean;
}

const INITIAL: FocusState = { mode: "main", picked: [], kinds: new Set(ALL_KINDS), query: "", sort: "importance", levels: DEFAULT_LEVELS, includeAuxiliary: false };

export interface DfdFocus {
  state: FocusState;
  result: FocusResult;
  /** Os componentes que se podem escolher (a vista antes do foco, filtrada e ordenada). */
  rows: NodeRow[];
  /** O utilizador mexeu em alguma coisa (o canvas deixa de usar o diagrama guardado). */
  touched: boolean;
  setMode: (mode: FocusMode) => void;
  togglePicked: (id: string) => void;
  toggleKind: (kind: GraphNodeKind) => void;
  setQuery: (query: string) => void;
  setSort: (sort: FocusSort) => void;
  setLevels: (levels: DetailLevel) => void;
  setIncludeAuxiliary: (include: boolean) => void;
  reset: () => void;
}

const EMPTY: GraphView = { nodes: [], edges: [], children: {} };

/**
 * O que se vê na vista completa do diagrama. Por defeito é o fluxo principal (sem limite de componentes) de um diagrama sem
 * testes, documentação nem exemplos e com 2 níveis de pastas; o utilizador pode escolher componentes, pedir o diagrama inteiro,
 * filtrar por tipo, mudar quantos níveis de pastas se veem e voltar a incluir testes e documentação.
 */
export function useDfdFocus(graph: DfdGraph | null): DfdFocus {
  const [state, setState] = useState<FocusState>(INITIAL);
  const [touched, setTouched] = useState(false);

  const base = useMemo(() => {
    if (!graph) return EMPTY;
    const shaped = state.includeAuxiliary ? graph : withoutAuxiliary(graph);
    return project(shaped, { expanded: state.levels === "all" ? "all" : expandToDepth(shaped, state.levels) });
  }, [graph, state.includeAuxiliary, state.levels]);

  const result = useMemo(() => applyFocus(base, { mode: state.mode, picked: state.picked, kinds: state.kinds }), [base, state.mode, state.picked, state.kinds]);
  const rows = useMemo(() => listNodes(base, { kinds: state.kinds, query: state.query, sort: state.sort }), [base, state.kinds, state.query, state.sort]);

  const update = useCallback((change: (current: FocusState) => FocusState) => {
    setTouched(true);
    setState(change);
  }, []);

  const shownKey = result.view.nodes.map((n) => n.id).join("\u0000");
  const setMode = useCallback(
    (mode: FocusMode) => {
      // Ao passar a escolher, parte-se do que já se via: é mais fácil tirar e pôr do que começar de zero.
      update((current) => ({ ...current, mode, picked: mode === "pick" && current.mode !== "pick" ? shownKey.split("\u0000").filter(Boolean) : current.picked }));
    },
    [update, shownKey],
  );
  const togglePicked = useCallback(
    (id: string) => update((current) => ({ ...current, picked: current.picked.includes(id) ? current.picked.filter((p) => p !== id) : [...current.picked, id] })),
    [update],
  );
  const toggleKind = useCallback(
    (kind: GraphNodeKind) =>
      update((current) => {
        const kinds = new Set(current.kinds);
        if (!kinds.delete(kind)) kinds.add(kind);
        // Sem nenhum tipo não há nada para ver: volta a todos.
        return { ...current, kinds: kinds.size ? kinds : new Set(ALL_KINDS) };
      }),
    [update],
  );
  const setQuery = useCallback((query: string) => setState((current) => ({ ...current, query })), []);
  const setSort = useCallback((sort: FocusSort) => setState((current) => ({ ...current, sort })), []);
  const setLevels = useCallback((levels: DetailLevel) => update((current) => ({ ...current, levels })), [update]);
  const setIncludeAuxiliary = useCallback((includeAuxiliary: boolean) => update((current) => ({ ...current, includeAuxiliary })), [update]);
  const reset = useCallback(() => update(() => INITIAL), [update]);

  return { state, result, rows, touched, setMode, togglePicked, toggleKind, setQuery, setSort, setLevels, setIncludeAuxiliary, reset };
}
