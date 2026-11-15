import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardReportDocument } from "@/components/report/dashboard-report-document";
import { mockAnalysis } from "@/lib/api/mock/analysis";
import type { RepositoryAnalysis } from "@/lib/api/types";
import { risksByNode } from "@/lib/findings";
import { DashboardHeader } from "./dashboard-header";
import { DfdTab } from "./dfd-tab";
import { HygieneChart } from "./hygiene-chart";
import { TeamTab } from "./team-tab";
import { ThreatsTab } from "./threats-tab";

const forced= vi.hoisted(() => ({ state: undefined as unknown }));

vi.mock("react", async (original) => {
  const actual= await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (forced.state !== undefined) {
        const value= forced.state;
        forced.state= undefined;
        return [value, () => undefined];
      }
      return actual.useState(initial as never);
    },
  };
});

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", { src: String(props.src), alt: String(props.alt ?? "") }),
}));

const analysis: RepositoryAnalysis= { ...mockAnalysis, repository: "deti-org/payment-service" };
const risks= risksByNode(analysis.dfd, analysis.findings);
const noop= () => undefined;

afterEach(() => {
  forced.state= undefined;
});

function withState(value: unknown) {
  forced.state= value;
}

describe("demo dashboard markup", () => {
  it("team tab", () => {
    expect(renderToStaticMarkup(<TeamTab analysis={analysis} />)).toMatchSnapshot();
  });

  it.each(["commits", "merge", "activity"])("hygiene chart, %s view", (view) => {
    withState(view);
    expect(renderToStaticMarkup(<HygieneChart team={analysis.team} />)).toMatchSnapshot();
  });

  it("header", () => {
    const html= renderToStaticMarkup(
      <DashboardHeader
        repository={analysis.repository}
        lastScanned={analysis.lastScanned}
        branches={analysis.branches}
        branch={analysis.defaultBranch}
        onBranchChange={noop}
        scans={analysis.scans}
        scanId={analysis.scans[0].id}
        onScanChange={noop}
        onBack={noop}
        onScan={noop}
        onExport={noop}
      />,
    );
    expect(html).toMatchSnapshot();
  });

  it("threats tab", () => {
    const html= renderToStaticMarkup(
      <ThreatsTab analysis={analysis} risks={risks} nodeId={risks[0].node.id} reasons={{}} onTriage={noop} onSelectNode={noop} onShowInDiagram={noop} />,
    );
    expect(html).toMatchSnapshot();
  });

  it("dfd tab", () => {
    const html= renderToStaticMarkup(
      <DfdTab model={analysis.dfd} risks={risks} nodeId={risks[0].node.id} onSelectNode={noop} onOpenThreats={noop} onEdit={noop} />,
    );
    expect(html).toMatchSnapshot();
  });

  it("printed report", () => {
    expect(renderToStaticMarkup(<DashboardReportDocument analysis={analysis} branch="main" />)).toMatchSnapshot();
  });
});
