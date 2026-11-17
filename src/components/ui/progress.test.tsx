import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { LoadingPanel } from "./loading-panel";
import { CIRCUMFERENCE, ProgressRing } from "./progress-ring";

const ring = (props: Parameters<typeof ProgressRing>[0]) => renderToStaticMarkup(createElement(ProgressRing, props));

describe("ProgressRing", () => {
  it("is a progress bar that says how far along it is", () => {
    const out = ring({ value: 0.42, label: "Analysing" });
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-label="Analysing"');
    expect(out).toContain('aria-valuenow="42"');
    expect(out).toContain('aria-valuetext="42%"');
    expect(out).toContain(">42%<");
  });

  it("fills the circle in proportion to the value", () => {
    const offset = (value: number) => Number(ring({ value, label: "x" }).match(/stroke-dashoffset="([\d.]+)"/)![1]);
    expect(offset(0)).toBeCloseTo(CIRCUMFERENCE, 1);
    expect(offset(0.5)).toBeCloseTo(CIRCUMFERENCE / 2, 1);
    expect(offset(1)).toBeCloseTo(0, 1);
  });

  it("without a value it spins and shows no percentage or value", () => {
    for (const value of [undefined, null, Number.NaN]) {
      const out = ring({ value, label: "Loading" });
      expect(out).toContain("indeterminate");
      expect(out).not.toContain("aria-valuenow");
      expect(out).not.toContain("%<");
      expect(out).toContain('aria-valuetext="In progress"');
    }
  });

  it("keeps a value outside 0 to 1 inside the circle", () => {
    expect(ring({ value: 7, label: "x" })).toContain('aria-valuenow="100"');
    expect(ring({ value: -3, label: "x" })).toContain('aria-valuenow="0"');
  });

  it("leaves the number out when the ring is too small to hold it", () => {
    expect(ring({ value: 0.5, size: 24, label: "x" })).not.toContain("50%<");
    expect(ring({ value: 0.5, size: 24, showPercent: true, label: "x" })).toContain('aria-valuenow="50"');
    expect(ring({ value: 0.5, size: 88, showPercent: false, label: "x" })).not.toContain("50%<");
  });
});

describe("LoadingPanel", () => {
  it("shows what is being done, as a status that screen readers announce politely", () => {
    const out = renderToStaticMarkup(createElement(LoadingPanel, { title: "Inferring the architecture", detail: "Reading 3 of 9 files", progress: 0.33 }));
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-live="polite"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain("Inferring the architecture");
    expect(out).toContain("Reading 3 of 9 files");
    expect(out).toContain('aria-valuenow="33"');
  });

  it("lists the steps with the current one marked", () => {
    const steps = [{ label: "One", state: "done" as const }, { label: "Two", state: "active" as const }, { label: "Three", state: "todo" as const }];
    const out = renderToStaticMarkup(createElement(LoadingPanel, { title: "t", steps }));
    expect(out).toMatch(/class="done"[^>]*>.*One/);
    expect(out).toMatch(/class="active" aria-current="step"[^>]*>.*Two/);
    expect(out.match(/aria-current/g)).toHaveLength(1);
  });

  it("works without detail, steps or a value", () => {
    const out = renderToStaticMarkup(createElement(LoadingPanel, { title: "Loading" }));
    expect(out).toContain("Loading");
    expect(out).not.toContain("<ol");
    expect(out).toContain("indeterminate");
  });
});
