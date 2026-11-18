import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DfdFocus, FocusState } from "@/hooks/use-dfd-focus";
import { ALL_KINDS, applyFocus, listNodes } from "@/lib/dfd/focus";
import type { GraphView } from "@/lib/dfd/project";
import type { GraphNode } from "@/lib/dfd/schema";
import { FocusBar } from "./focus-bar";

const provenance = { source: "code" as const, confidence: "medium" as const, evidence: [{ note: "t" }] };
const nodes: GraphNode[] = Array.from({ length: 30 }, (_, i) => ({ id: `process:f${i}`, kind: "process", name: `folder-${i}`, path: `f${i}`, provenance }));
const view: GraphView = {
  nodes,
  edges: nodes.slice(0, -1).map((n, i) => ({ id: `e${i}`, source: n.id, target: nodes[i + 1].id, label: "imports", provenance })),
  children: {},
};

function focusIn(change: Partial<FocusState>): DfdFocus {
  const state: FocusState = { mode: "main", picked: [], kinds: new Set(ALL_KINDS), query: "", sort: "importance", levels: 2, includeAuxiliary: false, ...change };
  return {
    state,
    result: applyFocus(view, { mode: state.mode, picked: state.picked, kinds: state.kinds }),
    rows: listNodes(view, { kinds: state.kinds, query: state.query, sort: state.sort }),
    touched: false,
    setMode: vi.fn(), setLevels: vi.fn(), setIncludeAuxiliary: vi.fn(), togglePicked: vi.fn(), toggleKind: vi.fn(), setQuery: vi.fn(), setSort: vi.fn(), reset: vi.fn(),
  };
}

const html = (focus: DfdFocus) => renderToStaticMarkup(createElement(FocusBar, { focus }));

describe("FocusBar", () => {
  it("starts on the main flow and says how much of the diagram that is", () => {
    const out = html(focusIn({}));
    expect(out).toContain("Main data flow: 10 of 30 components.");
    expect(out).toMatch(/aria-checked="true"[^>]*>Main flow/);
    expect(out).not.toContain("Reset");
    expect(out).not.toContain('type="search"');
  });

  it("explains how the main flow is chosen", () => {
    const out = html(focusIn({}));
    expect(out).toContain("How is the main flow chosen?");
    expect(out).toContain("every component on a path");
    expect(html(focusIn({ mode: "all" }))).not.toContain("How is the main flow chosen?");
  });

  it("says plainly when there is nothing to leave out", () => {
    const small = { ...focusIn({}), result: { view, total: 30, shown: 30 } };
    expect(html(small)).toContain("Showing all 30 components: nothing to leave out.");
  });

  it("lists the components to choose from, with a checked box for each one chosen and no limit on how many", () => {
    const picked = nodes.slice(0, 14).map((n) => n.id);
    const out = html(focusIn({ mode: "pick", picked }));
    expect(out.match(/type="checkbox"/g)).toHaveLength(30 + 1); // 30 componentes e a opção dos testes
    expect(out.match(/checked=""/g)).toHaveLength(14);
    expect(out).toContain("14 of 30 components chosen.");
    expect(out).not.toContain("disabled");
  });

  it("filters the list by what was typed", () => {
    const out = html(focusIn({ mode: "pick", picked: [], query: "folder-2" }));
    expect(out.match(/type="checkbox"/g)).toHaveLength(11 + 1); // folder-2 e folder-20 ... folder-29, e a opção dos testes
    expect(html(focusIn({ mode: "pick", query: "zzz" }))).toContain("No component matches.");
  });

  it("offers the level of detail and the tests and docs option, and shows when they were changed", () => {
    const base = html(focusIn({}));
    expect(base).toContain("2 levels");
    expect(base).toContain("Include tests, docs and examples");
    expect(base).not.toContain("Reset");
    expect(html(focusIn({ levels: 3 }))).toContain("Reset");
    expect(html(focusIn({ includeAuxiliary: true }))).toContain("Reset");
  });

});
