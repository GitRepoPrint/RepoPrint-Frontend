import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DfdFocus, FocusState } from "@/hooks/use-dfd-focus";
import { ALL_KINDS, MAX_FOCUS_NODES, applyFocus, listNodes } from "@/lib/dfd/focus";
import type { GraphView } from "@/lib/dfd/project";
import type { GraphNode } from "@/lib/dfd/schema";
import { FocusBar } from "./focus-bar";

const provenance = { source: "code" as const, confidence: "medium" as const, evidence: [{ note: "t" }] };
const nodes: GraphNode[] = Array.from({ length: 30 }, (_, i) => ({ id: `process:f${i}`, kind: "process", name: `folder-${i}`, provenance }));
const view: GraphView = {
  nodes,
  edges: nodes.slice(0, -1).map((n, i) => ({ id: `e${i}`, source: n.id, target: nodes[i + 1].id, label: "imports", provenance })),
  children: {},
};

function focusIn(change: Partial<FocusState>): DfdFocus {
  const state: FocusState = { mode: "main", picked: [], kinds: new Set(ALL_KINDS), query: "", sort: "importance", ...change };
  return {
    state,
    result: applyFocus(view, { mode: state.mode, picked: state.picked, kinds: state.kinds }),
    rows: listNodes(view, { kinds: state.kinds, query: state.query, sort: state.sort }),
    max: MAX_FOCUS_NODES,
    touched: false,
    setMode: vi.fn(), togglePicked: vi.fn(), toggleKind: vi.fn(), setQuery: vi.fn(), setSort: vi.fn(), reset: vi.fn(),
  };
}

const html = (focus: DfdFocus) => renderToStaticMarkup(createElement(FocusBar, { focus }));

describe("FocusBar", () => {
  it("starts on the main flow and says how much of the diagram is shown", () => {
    const out = html(focusIn({}));
    expect(out).toContain("Showing the 10 components the data flows through most, out of 30.");
    expect(out).toMatch(/aria-checked="true"[^>]*>Main flow/);
    expect(out).not.toContain("Back to main flow");
    expect(out).not.toContain('type="checkbox"');
  });

  it("lists the components to choose from, with a checked box for each one chosen", () => {
    const out = html(focusIn({ mode: "pick", picked: ["process:f1", "process:f2"] }));
    expect(out.match(/type="checkbox"/g)).toHaveLength(30);
    expect(out.match(/checked=""/g)).toHaveLength(2);
    expect(out).toContain("2 of 10 components chosen");
    expect(out).toContain("Back to main flow");
    expect(out).not.toContain("at most 10 components");
  });

  it("blocks choosing an eleventh component and explains why", () => {
    const picked = nodes.slice(0, MAX_FOCUS_NODES).map((n) => n.id);
    const out = html(focusIn({ mode: "pick", picked }));
    expect(out).toContain("The diagram shows at most 10 components at a time");
    expect(out.match(/disabled=""/g)).toHaveLength(30 - MAX_FOCUS_NODES);
  });

  it("filters the list by what was typed", () => {
    const out = html(focusIn({ mode: "pick", picked: [], query: "folder-2" }));
    expect(out.match(/type="checkbox"/g)).toHaveLength(11); // folder-2 and folder-20 ... folder-29
    expect(html(focusIn({ mode: "pick", query: "zzz" }))).toContain("No component matches.");
  });

  it("says plainly when the whole diagram is shown", () => {
    expect(html(focusIn({ mode: "all" }))).toContain("Showing the whole diagram: 30 of 30 components.");
  });

  it("shows that a kind filter is on", () => {
    const out = html(focusIn({ kinds: new Set(["data_store"]) }));
    expect(out).toContain("Back to main flow");
    expect(out).toMatch(/aria-pressed="true"[^>]*>Data stores/);
    expect(out).toMatch(/aria-pressed="false"[^>]*>Processes/);
  });
});
