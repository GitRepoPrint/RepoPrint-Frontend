import { describe, expect, it } from "vitest";
import {
  attachFindingsToDfdModel,
  mapConfidence,
  mapEffort,
  mapSeverity,
  strideFindingToFinding,
  strideReportToFindings,
} from "./stride";
import type { StrideFinding, StrideReport } from "./stride";
import type { DfdModel } from "./types";

describe("stride api helpers", () => {
  it("maps severities correctly", () => {
    expect(mapSeverity("Critical")).toBe("high");
    expect(mapSeverity("High")).toBe("high");
    expect(mapSeverity("Medium")).toBe("medium");
    expect(mapSeverity("Low")).toBe("low");
  });

  it("maps confidence to probability", () => {
    expect(mapConfidence("High")).toBe("high");
    expect(mapConfidence("Medium")).toBe("medium");
    expect(mapConfidence("Low")).toBe("low");
  });

  it("maps effort according to finding type and severity", () => {
    expect(mapEffort("vulnerability", "High")).toEqual({ level: "medium", estimate: "1-2 days" });
    expect(mapEffort("architectural_hardening", "Medium")).toEqual({ level: "high", estimate: "1-2 weeks" });
    expect(mapEffort("vulnerability", "Low")).toEqual({ level: "low", estimate: "~4 hours" });
  });

  it("converts StrideFinding to frontend Finding", () => {
    const raw: StrideFinding = {
      threat_id: "STRIDE-S-01",
      category: "Spoofing",
      stride_letter: "S",
      severity: "High",
      target_type: "process",
      finding_type: "vulnerability",
      confidence: "High",
      component_id: "process:app/routes",
      component_name: "routes",
      title: "Unauthenticated API Endpoint",
      description: "Routes accept unauthenticated calls.",
      mitigation: "Enforce JWT authentication middleware.",
      references: ["CWE-306"],
      file_path: "app/routes.py",
    };

    const finding = strideFindingToFinding(raw);
    expect(finding.id).toBe("STRIDE-S-01-process:app/routes");
    expect(finding.framework).toBe("STRIDE");
    expect(finding.category).toBe("Spoofing");
    expect(finding.severity).toBe("high");
    expect(finding.title).toBe("Unauthenticated API Endpoint");
    expect(finding.file).toBe("app/routes.py");
    expect(finding.ref).toBe("S-01");
    expect(finding.regulatoryTags).toContain("CWE-306");
  });

  it("attaches findings to DfdModel nodes", () => {
    const model: DfdModel = {
      nodes: [
        {
          id: "process:app/routes",
          title: "routes",
          subtitle: "PROCESS",
          kind: "process",
          x: 100,
          y: 100,
          code: "PR-001",
          classification: "Internal service",
          findingIds: [],
        },
        {
          id: "data_store:users",
          title: "users",
          subtitle: "STORE",
          kind: "store",
          x: 200,
          y: 100,
          code: "DS-001",
          classification: "Database",
          findingIds: [],
        },
      ],
      flows: [],
      edges: [],
    };

    const rawFinding: StrideFinding = {
      threat_id: "STRIDE-S-01",
      category: "Spoofing",
      stride_letter: "S",
      severity: "High",
      target_type: "process",
      finding_type: "vulnerability",
      confidence: "High",
      component_id: "process:app/routes",
      title: "Unauthenticated API Endpoint",
      description: "Test description",
    };

    const report: StrideReport = {
      repository: "test/repo",
      total_findings: 1,
      actionable_vulnerabilities_count: 1,
      architectural_recommendations_count: 0,
      summary_by_category: { Spoofing: 1 },
      summary_by_severity: { High: 1 },
      summary_by_type: { vulnerability: 1 },
      summary_by_confidence: { High: 1 },
      stride_matrix: { "process:app/routes": ["Spoofing"] },
      findings: [rawFinding],
      actionable_vulnerabilities: [rawFinding],
      architectural_recommendations: [],
    };

    const findings = strideReportToFindings(report);
    const updated = attachFindingsToDfdModel(model, report, findings);

    expect(updated.nodes[0].findingIds).toContain(findings[0].id);
    expect(updated.nodes[1].findingIds).toHaveLength(0);
  });
});
