import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { DfdModel } from "@/lib/api/types";
import { DfdScene, FIT_ZOOM, stepZoom } from "./dfd-scene";

const node = (id: string, x: number) => ({ id, title: id, subtitle: "PROCESS", kind: "process" as const, x, y: 60, code: "PR-001", classification: "Internal service", findingIds: [] });
const model = (edges: DfdModel["edges"]): DfdModel => ({
  viewBox: { width: 600, height: 200 }, nodes: [node("a", 100), node("b", 300)], edges, flows: edges.map((_, i) => `M${i} 0 L10 10`),
});
const edge = (extra: Partial<DfdModel["edges"][number]> = {}): DfdModel["edges"][number] => ({ id: "e", source: "a", target: "b", sourceHandle: "r", targetHandle: "l", label: "CALLS", ...extra });
const html = (m: DfdModel, fit = false) => renderToStaticMarkup(createElement(DfdScene, { model: m, risk: {}, selected: null, onSelect() {}, fit }));

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


describe("zooming the overview", () => {
  const fitted = () => html(model([edge()]), true);

  it("has the zoom buttons, the current zoom and a reset, and nothing claiming to be a status", () => {
    const out = fitted();
    for (const text of ['aria-label="Zoom out"', 'aria-label="Zoom in"', "Reset View", ">100%<"]) expect(out, text).toContain(text);
    expect(out).not.toContain("Fits the box");
    expect(out).not.toContain("Live Sync");
  });

  it("announces the new zoom to screen readers", () => {
    expect(fitted()).toMatch(/class="dfd-preview-zoom" aria-live="polite"/);
  });

  it("starts fitted: the drawing is exactly as big as the box, and the box can scroll once zoomed in", () => {
    const out = fitted();
    expect(out).toContain("width:100%;height:100%");
    expect(out).toContain('tabindex="0"');
    expect(out).toContain('role="region"');
  });

  it("the demo diagram keeps its own controls, including Live Sync", () => {
    const out = html(model([edge()]));
    expect(out).toContain("Live Sync");
    expect(out).toContain('aria-label="Zoom out"');
  });
});

describe("stepZoom", () => {
  it("goes up and down by one step", () => {
    expect(stepZoom(100, 1, FIT_ZOOM)).toBe(100 + FIT_ZOOM.step);
    expect(stepZoom(100, -1, FIT_ZOOM)).toBe(100 - FIT_ZOOM.step);
  });

  it("stops at both ends, so repeated clicks cannot lose the diagram or blow it up", () => {
    let z = 100;
    for (let i = 0; i < 40; i++) z = stepZoom(z, 1, FIT_ZOOM);
    expect(z).toBe(FIT_ZOOM.max);
    for (let i = 0; i < 40; i++) z = stepZoom(z, -1, FIT_ZOOM);
    expect(z).toBe(FIT_ZOOM.min);
  });

  it("lets you zoom in far enough to be useful for people who need it big, and out far enough to see everything", () => {
    expect(FIT_ZOOM.max).toBeGreaterThanOrEqual(200);
    expect(FIT_ZOOM.min).toBeLessThanOrEqual(50);
  });
});
