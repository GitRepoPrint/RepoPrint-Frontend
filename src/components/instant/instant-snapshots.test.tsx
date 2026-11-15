process.env.TZ= "UTC";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InstantReportDocument } from "@/components/report/instant-report-document";
import { mockInstantReport } from "@/lib/api/mock/instant-report";
import type { InstantReport as Report } from "@/lib/api/types";
import { InstantReport } from "./instant-report";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: () => ({ authenticated: false }) }));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", { src: String(props.src), alt: String(props.alt ?? "") }),
}));

const demo: Report= { ...mockInstantReport, repository: "deti-org/payment-service", analyzedAt: "2026-11-15T10:30:00Z" };

describe("demo instant analysis markup", () => {
  it("report", () => {
    expect(renderToStaticMarkup(<InstantReport report={demo} />)).toMatchSnapshot();
  });

  it("printed report", () => {
    expect(renderToStaticMarkup(<InstantReportDocument report={demo} />)).toMatchSnapshot();
  });

  it("report with activity notes", () => {
    const withActivity: Report= {
      ...demo,
      activity: {
        fetchedAt: "2026-11-15T10:30:00Z",
        refreshAvailableAt: "2026-11-15T10:40:00Z",
        cached: false,
        activeContributors: 7,
        botsExcluded: 1,
        contributorsWindow: { complete: true, commitsRead: 100, since: "2026-08-17T10:00:00Z" },
        mergeSampleSize: 12,
      },
    };
    expect(renderToStaticMarkup(<InstantReport report={withActivity} />)).toMatchSnapshot();
  });
});

describe("real instant analysis markup", () => {
  const real: Report= {
    source: "git",
    repository: "pallets/click",
    commit: null,
    branch: "main",
    analyzedAt: "2026-11-15T10:30:00Z",
    findings: [],
    summary: { stride: null, privacy: null, git: { prMergeHours: 17.5, commitsPerMonth: 31, codeOwnersCoverage: null } },
    activity: {
      fetchedAt: "2026-11-15T10:30:00Z",
      refreshAvailableAt: "2026-11-15T10:40:00Z",
      cached: false,
      activeContributors: 4,
      botsExcluded: 0,
      contributorsWindow: { complete: true, commitsRead: 91, since: "2026-08-17T10:00:00Z" },
      mergeSampleSize: 43,
    },
  };
  const page= renderToStaticMarkup(<InstantReport report={real} />);
  const printed= renderToStaticMarkup(<InstantReportDocument report={real} />);

  it("shows only what is measured from GitHub", () => {
    expect(page).toContain("pallets/click");
    expect(page).toContain("How these numbers are measured");
    expect(page).toContain("Commits / month");
    expect(page).toContain("Median PR merge time");
    expect(page).toContain("17.5");
  });

  it("drops everything that needs the code analysis, with no placeholders", () => {
    for (const text of ["SHA", "THREAT MODELING", "PRIVACY", "GIT INTELLIGENCE", "SEMI-AUTOMATED DFD", "Findings", "FINDINGS", "Not available", "Code Owners"]) {
      expect(page).not.toContain(text);
    }
  });

  it("shows no mock content", () => {
    for (const text of ["a3f89c1", "92%", "Auth Gateway", "Spoofing", "Payment Engine", "Linkability"]) expect(page).not.toContain(text);
  });

  it("prints only the Git sections", () => {
    expect(printed).toContain("Git Activity");
    expect(printed).toContain("Git Data Methodology");
    expect(printed).toContain("<td>31</td>");
    for (const text of ["Commit Hash", "STRIDE", "LINDDUN", "Data Flow Diagram", "Mitigations", "Not available", "Auth Gateway"]) expect(printed).not.toContain(text);
  });
});
