import { useCallback, useMemo, useState } from "react";
import { ALL_KINDS, MAX_FOCUS_NODES, applyFocus, listNodes } from "@/lib/dfd/focus";
import type { FocusMode, FocusResult, FocusSort, NodeRow } from "@/lib/dfd/focus";
import type { GraphView } from "@/lib/dfd/project";
import type { GraphNodeKind } from "@/lib/dfd/schema";

export interface FocusState {
  mode: FocusMode;
  picked: string[];
  kinds: ReadonlySet<GraphNodeKind>;
  query: string;
  sort: FocusSort;
}

const INITIAL: FocusState = { mode: "main", picked: [], kinds: new Set(ALL_KINDS), query: "", sort: "importance" };

export interface DfdFocus {
  state: FocusState;
  result: FocusResult;
  /** Os componentes que se podem escolher (a vista inteira, filtrada e ordenada). */
  rows: NodeRow[];
  max: number;
  /** O utilizador mexeu em alguma coisa (o canvas deixa de usar o diagrama guardado). */
  touched: boolean;
  setMode: (mode: FocusMode) => void;
  togglePicked: (id: string) => void;
  toggleKind: (kind: GraphNodeKind) => void;
  setQuery: (query: string) => void;
  setSort: (sort: FocusSort) => void;
  reset: () => void;
}

/**
 * O que se vê de um diagrama grande: por defeito o fluxo principal (no máximo MAX_FOCUS_NODES componentes), e o utilizador
 * pode escolher outros componentes ou pedir o diagrama inteiro. `view` é a vista inteira (depois de abrir e fechar componentes).
 */
export function useDfdFocus(view: GraphView | null, options: { pinned?: string; boost?: ReadonlySet<string> } = {}): DfdFocus {
  const [state, setState] = useState<FocusState>(INITIAL);
  const [touched, setTouched] = useState(false);
  const { pinned, boost } = options;

  const empty = useMemo<GraphView>(() => ({ nodes: [], edges: [], children: {} }), []);
  const base = view ?? empty;

  const result = useMemo(
    () => applyFocus(base, { mode: state.mode, picked: state.picked, kinds: state.kinds, pinned: pinned ? [pinned] : [], boost }),
    [base, state.mode, state.picked, state.kinds, pinned, boost],
  );
  const rows = useMemo(() => listNodes(base, { kinds: state.kinds, query: state.query, sort: state.sort }), [base, state.kinds, state.query, state.sort]);

  const update = useCallback((change: (current: FocusState) => FocusState) => {
    setTouched(true);
    setState(change);
  }, []);

  const shownIds = result.view.nodes.map((n) => n.id);
  const shownKey = shownIds.join("\u0000");

  const setMode = useCallback(
    (mode: FocusMode) => {
      // Ao passar a escolher, parte-se do que já se via: é mais fácil tirar e pôr do que começar de zero.
      update((current) => ({ ...current, mode, picked: mode === "pick" && current.mode !== "pick" ? shownKey.split("\u0000").filter(Boolean) : current.picked }));
    },
    [update, shownKey],
  );
  const togglePicked = useCallback(
    (id: string) =>
      update((current) => {
        if (current.picked.includes(id)) return { ...current, picked: current.picked.filter((p) => p !== id) };
        // O limite é imposto: passado o máximo, escolher mais não faz nada.
        if (current.picked.length >= MAX_FOCUS_NODES) return current;
        return { ...current, picked: [...current.picked, id] };
      }),
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
  const reset = useCallback(() => update(() => INITIAL), [update]);

  return { state, result, rows, max: MAX_FOCUS_NODES, touched, setMode, togglePicked, toggleKind, setQuery, setSort, reset };
}
