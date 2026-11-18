import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DfdPanel } from "@/components/dashboard/dfd-tab";
import { TABS } from "@/components/dashboard/dashboard-view";
import { TeamTab } from "@/components/dashboard/team-tab";
import { Skeleton } from "@/components/ui/skeleton";
import { mockAnalysis } from "@/lib/api/mock/analysis";
import { CanvasSkeleton, DashboardSkeleton, RepositoriesBodySkeleton, RepositoriesSkeleton } from "./page-skeletons";

let params: { repoId: string } = { repoId: "pallets--flask" };
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({ useParams: () => params, useSearchParams: () => query, useRouter: () => ({ push() {} }) }));
vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => createElement("img", { src: String(props.src), alt: String(props.alt ?? "") }) }));

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

/** Todas as classes CSS que um bloco de HTML usa. */
const classesOf = (markup: string) => new Set([...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));

/** As classes do esqueleto que não são do próprio esqueleto (skeleton, sk-*, utilitários): têm de existir também na página a sério. */
// (dashboard-main, dashboard-tab-content e dashboard-tab-panel são do DashboardView, que envolve o que se compara)
const OWN = /^(dashboard-main|dashboard-tab-content|dashboard-tab-panel|dashboard-tabs|dashboard-tab|active|skeleton|skeleton-circle|skeleton-chip|sk-.*|sr-only|h-\[.*|inline-flex!|flex-row!|bg-none!|pointer-events-none|z-5|absolute|inset-0|green|status-dot)$/;
const sharedWith = (skeleton: string, real: string) => [...classesOf(skeleton)].filter((c) => !OWN.test(c) && !classesOf(real).has(c));

describe("Skeleton", () => {
  it("is a decorative block: hidden from assistive technology", () => {
    const out = html(createElement(Skeleton, { width: 120, height: 14 }));
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("width:120px");
    expect(out).toContain("height:14px");
  });

});

describe.each([
  ["RepositoriesSkeleton", RepositoriesSkeleton, "Loading your repositories"],
  ["DashboardSkeleton", DashboardSkeleton, "Loading pallets/flask"],
  ["CanvasSkeleton", CanvasSkeleton, "Loading the diagram"],
])("%s", (_name, Component, label) => {
  it("says it is loading, once, for screen readers, and is busy", () => {
    const out = html(createElement(Component));
    expect(out).toContain('aria-busy="true"');
    expect(out.match(new RegExp(label, "g"))).toHaveLength(1);
  });

});

describe("skeletons are alive", () => {
  const css = readFileSync("src/styles/progress.css", "utf8");

  it("the movement is carried by a variable, because an animation can never beat an !important declaration", () => {
    // a causa de os esqueletos parecerem parados: os fundos levam !important (para ganhar ao CSS da página) e uma animação de
    // background-position perde sempre contra isso. Por isso o que se anima é uma variável registada, que o fundo lê.
    expect(css).toMatch(/@property --sk-pos \{[^}]*syntax: "<percentage>"/);
    expect(css).not.toMatch(/@keyframes skeleton-shimmer \{[^}]*background-position/);
    const important = css.match(/background: var\(--sk-gradient\)[^;]*!important;/g)!;
    expect(important.length).toBeGreaterThanOrEqual(4);
    for (const rule of important) expect(rule, rule).toContain("var(--sk-pos)");
  });

  it("whoever asks for less motion still sees it breathe: a slow fade, not a frozen screen", () => {
    expect(css).toContain("@keyframes skeleton-pulse");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .skeleton"));
    expect(reduced).toMatch(/animation: skeleton-pulse [0-9.]+s ease-in-out infinite/);
    expect(reduced).not.toMatch(/\.skeleton[^}]*animation: none/);
  });

});

describe("skeletons show shapes, not words", () => {
  it.each([["RepositoriesSkeleton", RepositoriesSkeleton], ["DashboardSkeleton", DashboardSkeleton], ["CanvasSkeleton", CanvasSkeleton]])("%s is masked, so no text is readable", (_name, Component) => {
    expect(html(createElement(Component))).toContain("sk-mask");
  });

  it("the body of the repositories list is masked too, where the page uses it while loading", () => {
    expect(html(createElement(RepositoriesBodySkeleton))).toContain('class="sk-mask"');
  });

});

describe("the dashboard skeleton matches the dashboard", () => {
  const header = html(createElement(DashboardHeader, {
    repository: "pallets/flask", lastScanned: "now", branches: ["main"], branch: "main", onBranchChange() {}, scans: [], scanId: "", onScanChange() {}, onBack() {}, onScan() {}, onExport() {},
  }));

  it("uses the same names for the tabs, in the same order, as the real page", () => {
    query = new URLSearchParams();
    const out = html(createElement(DashboardSkeleton));
    const labels = [...out.matchAll(/<span class="dashboard-tab[^"]*"><span>([^<]*)</g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(labels).toEqual(TABS.map((t) => t.label));
  });

  it("opens on the tab the address asks for, and on the team tab (what a real repository opens on) otherwise", () => {
    query = new URLSearchParams();
    expect(html(createElement(DashboardSkeleton))).toMatch(/dashboard-tab active"><span>Team Dynamics/);
    query = new URLSearchParams("tab=dfd");
    expect(html(createElement(DashboardSkeleton))).toMatch(/dashboard-tab active"><span>Inferred Architecture/);
    query = new URLSearchParams("tab=nonsense");
    expect(html(createElement(DashboardSkeleton))).toMatch(/dashboard-tab active"><span>Team Dynamics/);
    query = new URLSearchParams();
  });

  it("shows the real name of the repository, which the address already tells", () => {
    expect(html(createElement(DashboardSkeleton))).toContain("<span>pallets/flask</span>");
    params = { repoId: "isto-nao-e-um-nome" };
    expect(html(createElement(DashboardSkeleton))).toContain("Loading the repository");
    params = { repoId: "pallets--flask" };
  });

  it("has the same header as the real one: same classes, same fixed texts", () => {
    const skeleton = html(createElement(DashboardSkeleton));
    expect(sharedWith(skeleton.slice(0, skeleton.indexOf("dashboard-tabs")), header)).toEqual([]);
    for (const text of ["Scan Now", "Export PDF Report", "Analysis history", "Back to repositories"]) {
      expect(skeleton).toContain(text);
      expect(header).toContain(text);
    }
  });

  it("the team tab skeleton uses only classes the real team tab uses, and the same fixed texts", () => {
    query = new URLSearchParams("tab=team");
    const skeleton = html(createElement(DashboardSkeleton));
    const real = html(createElement(TeamTab, { analysis: { ...mockAnalysis, repository: "pallets/flask", source: "git" as const, team: { ...mockAnalysis.team, contributorsNote: "Commits in the last 90 days." } } }));
    expect(sharedWith(skeleton.slice(skeleton.indexOf("dashboard-tab-content")), real)).toEqual([]);
    for (const text of [
      "Team activity", "Repository hygiene", "Commits, pull request reviews and code ownership in the last 30 days.", "Branch rules, tests and license found through the GitHub API.",
      "Average commits per week", "Median PR merge time", "Code Owners coverage", "Contributor", "Review participation", "Code ownership",
      "Branch protection", "Tests and CI", "License", "Default branch", "Rules", "Also protected", "Not protected",
      "Git activity", "Commits per week", "PR merge time", "Activity by day and hour", "Git hygiene grade", "/ 100",
    ]) {
      expect(skeleton, `o esqueleto não tem "${text}"`).toContain(text);
      expect(real, `a página já não tem "${text}"`).toContain(text);
    }
    query = new URLSearchParams();
  });
});

describe("the diagram tab skeleton matches the diagram tab", () => {
  it("has the real button, legend and side panel texts, and a two-line note like the real one", () => {
    query = new URLSearchParams("tab=dfd");
    const out = html(createElement(DashboardSkeleton));
    for (const text of ["Edit DFD in Full Canvas", "High", "Medium", "Low", "No findings", "Number shows the findings on each component", "Selected component", "Where this comes from", "Fits the box"]) {
      expect(out, text).toContain(text);
    }
    const note = out.slice(out.indexOf('class="dfd-notice"'), out.indexOf("dfd-preview-section"));
    expect(note.match(/class="skeleton/g)).toHaveLength(2);
    query = new URLSearchParams();
  });

  it("uses only classes the real diagram panel uses", () => {
    query = new URLSearchParams("tab=dfd");
    const skeleton = html(createElement(DashboardSkeleton));
    const real = html(createElement(DfdPanel, { repository: "pallets/flask", model: mockAnalysis.dfd, findings: mockAnalysis.findings, nodeId: "", onSelectNode() {}, onOpenThreats() {}, onEdit() {}, inferred: { partial: false, files: 1 } }));
    expect(sharedWith(skeleton.slice(skeleton.indexOf("dfd-tab")), real)).toEqual([]);
    query = new URLSearchParams();
  });
});

describe("the repositories skeleton matches the repositories page", () => {
  it("has the real title, button, column headings and legend texts", () => {
    const out = html(createElement(RepositoriesSkeleton));
    for (const text of ["Your repositories", "Associate repository", "HEALTHY PROJECTS", "NEEDS ATTENTION", "Repository overview", "REPOSITORY", "SECURITY SCORE", "ADDED", "Add another repository"]) {
      expect(out).toContain(text);
    }
  });

  it("each row has the same parts, in the same order, as a real row", () => {
    const row = html(createElement(RepositoriesBodySkeleton, { rows: 1 })).match(/<div class="repository-row">.*?<\/div>/)![0];
    const order = ["repo-identity", "repo-icon", "repo-score", "repo-updated", "row-arrow"].map((c) => row.indexOf(c));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("the canvas skeleton matches the canvas", () => {
  it("uses the real toolbar, toolbox, inspector and diagram bar, so their sizes cannot differ", () => {
    const out = html(createElement(CanvasSkeleton));
    for (const text of ["BUILD YOUR MODEL", "Drag elements onto the canvas", "NODE INSPECTOR", "Select a component to inspect its security findings.", "Main flow", "Choose components", "Whole diagram", "Include tests, docs and examples", "Overview", "Data Flow Diagram", "LIVE CANVAS", "Auto Layout", "Save Diagram", "Export SVG"]) {
      expect(out, text).toContain(text);
    }
  });

  it("does not invent the sentence about how much of the diagram is shown", () => {
    const out = html(createElement(CanvasSkeleton));
    expect(out).not.toContain("nothing to leave out");
    expect(out).not.toContain("Main data flow:");
  });

  it("shows the branch from the address when there is one", () => {
    query = new URLSearchParams("branch=develop");
    expect(html(createElement(CanvasSkeleton))).toContain('<span class="canvas-branch">develop</span>');
    query = new URLSearchParams();
  });
});
