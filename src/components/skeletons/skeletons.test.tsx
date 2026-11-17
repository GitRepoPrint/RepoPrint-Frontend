import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "@/components/ui/skeleton";
import { CanvasSkeleton, DashboardSkeleton, RepositoriesSkeleton } from "./page-skeletons";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("Skeleton", () => {
  it("is a decorative block: hidden from assistive technology", () => {
    const out = html(createElement(Skeleton, { width: 120, height: 14 }));
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("skeleton");
    expect(out).toContain("width:120px");
    expect(out).toContain("height:14px");
  });

  it("takes percentages and rem as they are, and can be round", () => {
    expect(html(createElement(Skeleton, { width: "60%", height: "2rem" }))).toContain("width:60%");
    expect(html(createElement(Skeleton, { circle: true, width: 40, height: 40 }))).toContain("skeleton-circle");
  });
});

describe.each([
  ["RepositoriesSkeleton", RepositoriesSkeleton, "Loading your repositories"],
  ["DashboardSkeleton", DashboardSkeleton, "Loading the repository"],
  ["CanvasSkeleton", CanvasSkeleton, "Loading the diagram"],
])("%s", (_name, Component, label) => {
  it("says it is loading, once, for screen readers, and is busy", () => {
    const out = html(createElement(Component));
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain(label);
    expect(out.match(new RegExp(label, "g"))).toHaveLength(1);
  });

  it("is made of skeleton blocks and has no progress bar, spinner or percentage", () => {
    const out = html(createElement(Component));
    expect(out.match(/class="skeleton/g)!.length).toBeGreaterThan(5);
    expect(out).not.toContain("progressbar");
    expect(out).not.toContain("analysis-spinner");
    expect(out).not.toContain("%<");
  });
});
