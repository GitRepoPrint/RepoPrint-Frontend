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

  it("keeps the whole layout, with N/A where the code would be analyzed", () => {
    expect(page).toMatchSnapshot();
    expect(page).toContain("SHA <b>N/A</b>");
    expect(page.match(/N\/A <small>Findings<\/small>/g)?.length).toBe(2);
    expect(page).toContain("THREAT MODELING");
    expect(page).toContain("PRIVACY");
    expect(page).toContain("GIT INTELLIGENCE");
    expect(page).toContain("SEMI-AUTOMATED DFD");
    expect(page).toContain("N/A FINDINGS");
    expect(page).toContain("Grade 91 out of 100");
    expect(page).not.toContain("Code Owners");
    expect(page.match(/Not available/g)?.length).toBe(2);
  });

  it("keeps the real Git numbers in the grade card", () => {
    expect(page).toContain("<strong>31</strong> commits / month");
    expect(page).toContain("17.5");
  });

  it("has no GIT DATA box", () => {
    for (const text of ["GIT DATA", "How these numbers are measured", "data-notes"]) expect(page).not.toContain(text);
    expect(printed).not.toContain("Methodology");
  });

  it("has no mock content", () => {
    for (const text of ["a3f89c1", "92%", "Auth Gateway", "Spoofing", "Payment Engine", "Linkability"]) {
      expect(page).not.toContain(text);
      expect(printed).not.toContain(text);
    }
  });

  it("prints Not available in every section that needs the code", () => {
    expect(printed).toMatchSnapshot();
    expect(printed.match(/>Not available</g)?.length).toBeGreaterThanOrEqual(7);
    expect(printed).toContain("Grade 91");
    expect(printed).not.toContain("Code Owners");
    expect(printed).toContain("<dd>Not available</dd>");
  });
});
