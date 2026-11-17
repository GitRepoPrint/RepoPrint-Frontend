"use client";

import { useId } from "react";
import type { DfdFocus } from "@/hooks/use-dfd-focus";
import type { FocusMode, FocusSort } from "@/lib/dfd/focus";
import type { GraphNodeKind } from "@/lib/dfd/schema";

const MODES: { id: FocusMode; label: string }[] = [
  { id: "main", label: "Main flow" },
  { id: "pick", label: "Choose components" },
  { id: "all", label: "Whole diagram" },
];

const KINDS: { id: GraphNodeKind; label: string }[] = [
  { id: "process", label: "Processes" },
  { id: "data_store", label: "Data stores" },
  { id: "external_entity", label: "External" },
];

const SORTS: { id: FocusSort; label: string }[] = [
  { id: "importance", label: "Most connected" },
  { id: "name", label: "Name" },
  { id: "kind", label: "Type" },
];

const KIND_LABEL: Record<GraphNodeKind, string> = { process: "Process", data_store: "Data store", external_entity: "External" };

function summary(focus: DfdFocus): string {
  const { shown, total, overflow } = focus.result;
  if (focus.state.mode === "all") return `Showing the whole diagram: ${shown} of ${total} components.`;
  if (focus.state.mode === "pick") {
    return `${shown} of ${focus.max} components chosen${overflow ? ` (${overflow} more did not fit)` : ""}. The diagram has ${total}.`;
  }
  return total > shown ? `Showing the ${shown} components the data flows through most, out of ${total}.` : `Showing all ${total} components.`;
}

/**
 * Controla o que se vê de um diagrama grande: o fluxo principal (no máximo 10 componentes), componentes escolhidos à mão
 * (também no máximo 10) ou o diagrama inteiro. Filtra por tipo e por texto e ordena a lista de componentes.
 */
export function FocusBar({ focus }: { focus: DfdFocus }) {
  const id = useId();
  const { state } = focus;
  const atLimit = state.picked.length >= focus.max;

  return (
    <section className="dfd-focus" aria-label="What the diagram shows">
      <div className="dfd-focus-row">
        <div className="dfd-focus-modes" role="radiogroup" aria-label="View">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={state.mode === mode.id}
              className={`dfd-focus-mode ${state.mode === mode.id ? "active" : ""}`}
              onClick={() => focus.setMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="dfd-focus-kinds" role="group" aria-label="Types of component">
          {KINDS.map((kind) => (
            <button
              key={kind.id}
              type="button"
              aria-pressed={state.kinds.has(kind.id)}
              className={`dfd-focus-kind ${state.kinds.has(kind.id) ? "active" : ""}`}
              onClick={() => focus.toggleKind(kind.id)}
            >
              {kind.label}
            </button>
          ))}
        </div>
        {(state.mode !== "main" || state.kinds.size < KINDS.length) && (
          <button type="button" className="dfd-focus-reset" onClick={focus.reset}>Back to main flow</button>
        )}
      </div>

      <p className="dfd-focus-summary" role="status">{summary(focus)}</p>

      {state.mode === "pick" && (
        <div className="dfd-focus-picker">
          <div className="dfd-focus-picker-tools">
            <label htmlFor={`${id}-search`} className="sr-only">Search components</label>
            <input
              id={`${id}-search`}
              type="search"
              className="dfd-focus-search"
              placeholder="Search by name, folder or technology"
              value={state.query}
              onChange={(event) => focus.setQuery(event.target.value)}
            />
            <label htmlFor={`${id}-sort`} className="dfd-focus-sort">
              <span>Sort by</span>
              <select id={`${id}-sort`} value={state.sort} onChange={(event) => focus.setSort(event.target.value as FocusSort)}>
                {SORTS.map((sort) => <option key={sort.id} value={sort.id}>{sort.label}</option>)}
              </select>
            </label>
          </div>
          {atLimit && <p className="dfd-focus-limit" role="note">The diagram shows at most {focus.max} components at a time. Untick one to add another.</p>}
          <ul className="dfd-focus-list" aria-label="Components">
            {focus.rows.map((row) => {
              const checked = state.picked.includes(row.id);
              return (
                <li key={row.id}>
                  <label className={!checked && atLimit ? "disabled" : ""}>
                    <input type="checkbox" checked={checked} disabled={!checked && atLimit} onChange={() => focus.togglePicked(row.id)} />
                    <span className="dfd-focus-name">{row.name}</span>
                    <span className="dfd-focus-meta">{KIND_LABEL[row.kind]} · {row.connections} {row.connections === 1 ? "connection" : "connections"}</span>
                  </label>
                </li>
              );
            })}
            {focus.rows.length === 0 && <li className="dfd-focus-none">No component matches.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
