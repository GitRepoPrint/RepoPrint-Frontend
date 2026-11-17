import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { LoadingPanel } from "./loading-panel";
import { CIRCUMFERENCE, ProgressRing } from "./progress-ring";

const ring = (props: Parameters<typeof ProgressRing>[0]) => renderToStaticMarkup(createElement(ProgressRing, props));

describe("ProgressRing", () => {
  it("is a progress bar for assistive technology, but shows no number", () => {
    const out = ring({ value: 0.42, label: "Analysing" });
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-label="Analysing"');
    expect(out).toContain('aria-valuenow="42"');
    expect(out).not.toContain("%<");
    expect(out).not.toMatch(/>\s*42\s*</);
  });

  it("fills the circle in proportion to the value", () => {
    const offset = (value: number) => Number(ring({ value, label: "x" }).match(/stroke-dashoffset="([\d.]+)"/)![1]);
    expect(offset(0)).toBeCloseTo(CIRCUMFERENCE, 1);
    expect(offset(0.5)).toBeCloseTo(CIRCUMFERENCE / 2, 1);
    expect(offset(1)).toBeCloseTo(0, 1);
  });

  it("without a value it spins", () => {
    for (const value of [undefined, null, Number.NaN]) {
      const out = ring({ value, label: "Loading" });
      expect(out).toContain("indeterminate");
      expect(out).not.toContain("aria-valuenow");
      expect(out).toContain('aria-valuetext="In progress"');
    }
  });

  it("keeps a value outside 0 to 1 inside the circle", () => {
    expect(ring({ value: 7, label: "x" })).toContain('aria-valuenow="100"');
    expect(ring({ value: -3, label: "x" })).toContain('aria-valuenow="0"');
  });
});

describe("LoadingPanel", () => {
  it("shows what is being done, as a status that screen readers announce politely", () => {
    const out = renderToStaticMarkup(createElement(LoadingPanel, { title: "Reading the source code", detail: "Downloading the code · 3 of 9 files", progress: 0.33 }));
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-live="polite"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain("Reading the source code");
    expect(out).toContain("Downloading the code · 3 of 9 files");
    expect(out).toContain('aria-valuenow="33"');
  });

  it("is compact: a ring, a title and one line, with no list of steps and no percentage", () => {
    const out = renderToStaticMarkup(createElement(LoadingPanel, { title: "t", detail: "d", progress: 0.5 }));
    expect(out).not.toContain("<ol");
    expect(out).not.toContain("%<");
  });

  it("works without detail or a value, and then it just spins", () => {
    const out = renderToStaticMarkup(createElement(LoadingPanel, { title: "Loading" }));
    expect(out).toContain("Loading");
    expect(out).toContain("indeterminate");
  });
});
