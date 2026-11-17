import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { DfdModel } from "@/lib/api/types";
import { DfdScene } from "./dfd-scene";

const node = (id: string, x: number) => ({ id, title: id, subtitle: "PROCESS", kind: "process" as const, x, y: 60, code: "PR-001", classification: "Internal service", findingIds: [] });
const model = (edges: DfdModel["edges"]): DfdModel => ({
  viewBox: { width: 600, height: 200 }, nodes: [node("a", 100), node("b", 300)], edges, flows: edges.map((_, i) => `M${i} 0 L10 10`),
});
const edge = (extra: Partial<DfdModel["edges"][number]> = {}): DfdModel["edges"][number] => ({ id: "e", source: "a", target: "b", sourceHandle: "r", targetHandle: "l", label: "CALLS", ...extra });
const html = (m: DfdModel) => renderToStaticMarkup(createElement(DfdScene, { model: m, risk: {}, selected: null, onSelect() {} }));

describe("DfdScene lines", () => {
  it("draws a data flow firm and a code dependency dashed", () => {
    const out = html(model([edge({ id: "f" }), edge({ id: "d", label: "IMPORTS", kind: "dependency" })]));
    expect(out.match(/class="dfd-flow-link"/g)).toHaveLength(1);
    expect(out.match(/class="dfd-flow-link dependency"/g)).toHaveLength(1);
  });

  it("puts an arrow at both ends of a two-way dependency, and only defines the second arrow when needed", () => {
    const two = html(model([edge({ kind: "dependency", bidirectional: true })]));
    expect(two).toContain('marker-start="url(#dfd-preview-arrow-start)"');
    expect(two).toContain('orient="auto-start-reverse"');
    const one = html(model([edge()]));
    expect(one).not.toContain("marker-start");
    expect(one).not.toContain("dfd-preview-arrow-start");
  });
});
