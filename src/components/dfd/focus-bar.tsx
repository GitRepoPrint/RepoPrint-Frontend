"use client";

import { useId } from "react";
import type { DetailLevel, DfdFocus } from "@/hooks/use-dfd-focus";
import { DEFAULT_LEVELS } from "@/hooks/use-dfd-focus";
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

const LEVELS: { id: DetailLevel; label: string }[] = [
  { id: 1, label: "1 level of folders" },
  { id: 2, label: "2 levels" },
  { id: 3, label: "3 levels" },
  { id: "all", label: "All levels" },
];

const KIND_LABEL: Record<GraphNodeKind, string> = { process: "Process", data_store: "Data store", external_entity: "External" };

function summary(focus: DfdFocus): string {
  const { shown, total } = focus.result;
  if (focus.state.mode === "all") return `Whole diagram: ${shown} components.`;
  if (focus.state.mode === "pick") return `${shown} of ${total} components chosen.`;
  return shown < total ? `Main data flow: ${shown} of ${total} components.` : `Showing all ${total} components: nothing to leave out.`;
}

const parseLevels = (value: string): DetailLevel => (value === "all" ? "all" : (Number(value) as 1 | 2 | 3));

/**
 * Controla o que se vê na vista completa do diagrama: o fluxo principal (sem limite de componentes), componentes escolhidos à
 * mão ou o diagrama inteiro; filtra por tipo, escolhe quantos níveis de pastas se veem e se entram testes e documentação.
 */
export function FocusBar({ focus }: { focus: DfdFocus }) {
  const id = useId();
  const { state } = focus;
  const changed = state.mode !== "main" || state.kinds.size < KINDS.length || state.levels !== DEFAULT_LEVELS || state.includeAuxiliary;

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
        <label htmlFor={`${id}-levels`} className="dfd-focus-sort">
          <span>Detail</span>
          <select id={`${id}-levels`} value={String(state.levels)} onChange={(event) => focus.setLevels(parseLevels(event.target.value))}>
            {LEVELS.map((level) => <option key={String(level.id)} value={String(level.id)}>{level.label}</option>)}
          </select>
        </label>
        <label className="dfd-focus-check">
          <input type="checkbox" checked={state.includeAuxiliary} onChange={(event) => focus.setIncludeAuxiliary(event.target.checked)} />
          <span>Include tests, docs and examples</span>
        </label>
        {changed && <button type="button" className="dfd-focus-reset" onClick={focus.reset}>Reset</button>}
      </div>

      <p className="dfd-focus-summary" role="status">{summary(focus)}</p>
      {state.mode === "main" && (
        <details className="dfd-focus-help">
          <summary>How is the main flow chosen?</summary>
          <p>
            It follows the data. Where requests come in (code that receives calls from the client) and where data ends up (databases
            and outside services, and the code that touches them) are the two ends; the main flow is every component on a path between
            them. Utilities, configuration and models that are not on any such path are left out, and so are tests, documentation,
            examples and scripts unless you include them.
          </p>
        </details>
      )}

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
          <ul className="dfd-focus-list" aria-label="Components">
            {focus.rows.map((row) => (
              <li key={row.id}>
                <label>
                  <input type="checkbox" checked={state.picked.includes(row.id)} onChange={() => focus.togglePicked(row.id)} />
                  <span className="dfd-focus-name">{row.name}</span>
                  <span className="dfd-focus-meta">{KIND_LABEL[row.kind]} · {row.connections} {row.connections === 1 ? "connection" : "connections"}</span>
                </label>
              </li>
            ))}
            {focus.rows.length === 0 && <li className="dfd-focus-none">No component matches.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
