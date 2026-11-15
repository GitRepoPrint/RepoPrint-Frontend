process.env.TZ= "UTC";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InstantReportDocument } from "@/components/report/instant-report-document";
import type { InstantReport as Report } from "@/lib/api/types";
import { InstantReport } from "./instant-report";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("@/lib/auth/auth-provider", () => ({ useAuth: () => ({ authenticated: false }) }));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", { src: String(props.src), alt: String(props.alt ?? "") }),
}));

const report: Report= {
  repository: "pallets/click",
  branch: "main",
  analyzedAt: "2026-11-15T10:30:00Z",
  commitsPerMonth: 31,
  prMergeHours: 17.5,
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

describe("instant analysis markup", () => {
  const page= renderToStaticMarkup(<InstantReport report={report} />);
  const printed= renderToStaticMarkup(<InstantReportDocument report={report} />);

  it("shows only the Git numbers and how they are measured", () => {
    expect(page).toMatchSnapshot();
    expect(page).toContain("pallets/click");
    expect(page).toContain("GIT DATA");
    expect(page).toContain("How these numbers are measured");
    expect(page).toContain("Commits / month");
    expect(page).toContain("17.5");
  });

  it("has nothing that needs the code analysis", () => {
    for (const text of ["SHA", "THREAT MODELING", "PRIVACY", "GIT INTELLIGENCE", "SEMI-AUTOMATED DFD", "FINDINGS", "Not available", "Code Owners"]) {
      expect(page).not.toContain(text);
    }
    for (const text of ["a3f89c1", "92%", "Auth Gateway", "Spoofing", "Payment Engine", "Linkability"]) expect(page).not.toContain(text);
  });

  it("prints only the Git sections", () => {
    expect(printed).toMatchSnapshot();
    expect(printed).toContain("Git Activity");
    expect(printed).toContain("Git Data Methodology");
    expect(printed).toContain("<td>31</td>");
    for (const text of ["Commit Hash", "STRIDE", "LINDDUN", "Data Flow Diagram", "Mitigations", "Not available", "Auth Gateway"]) expect(printed).not.toContain(text);
  });
});
