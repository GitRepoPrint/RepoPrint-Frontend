import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLinddunCache,
  fetchLinddunAnalysis,
  fetchLinddunCatalog,
  normalizeCategory,
  normalizeReport,
  normalizeRepoUrl,
  normalizeSeverity,
  peekLinddun,
} from "./client";

describe("LINDDUN API client", () => {
  beforeEach(() => {
    clearLinddunCache();
  });

  describe("normalizeRepoUrl", () => {
    it("prepends https://github.com/ when URL is owner/repo", () => {
      expect(normalizeRepoUrl("pallets/flask")).toBe("https://github.com/pallets/flask");
      expect(normalizeRepoUrl("  org/repo  ")).toBe("https://github.com/org/repo");
    });

    it("leaves full HTTP / HTTPS URLs unchanged", () => {
      expect(normalizeRepoUrl("https://github.com/org/repo")).toBe("https://github.com/org/repo");
      expect(normalizeRepoUrl("http://gitlab.com/group/project")).toBe("http://gitlab.com/group/project");
    });
  });

  describe("normalizeCategory & normalizeSeverity", () => {
    it("maps category variations to canonical LinddunCategory", () => {
      expect(normalizeCategory("linkability")).toBe("Linkability");
      expect(normalizeCategory("IDENTIFIABILITY")).toBe("Identifiability");
      expect(normalizeCategory("non_repudiation")).toBe("Non-repudiation");
      expect(normalizeCategory("non-repudiation")).toBe("Non-repudiation");
      expect(normalizeCategory("detectability")).toBe("Detectability");
      expect(normalizeCategory("disclosure_of_information")).toBe("Disclosure of information");
      expect(normalizeCategory("Disclosure of information")).toBe("Disclosure of information");
      expect(normalizeCategory("unawareness")).toBe("Unawareness");
      expect(normalizeCategory("non_compliance")).toBe("Non-compliance");
      expect(normalizeCategory("non-compliance")).toBe("Non-compliance");
    });

    it("maps severity to canonical LinddunSeverity", () => {
      expect(normalizeSeverity("critical")).toBe("Critical");
      expect(normalizeSeverity("CRITICAL")).toBe("Critical");
      expect(normalizeSeverity("high")).toBe("High");
      expect(normalizeSeverity("medium")).toBe("Medium");
      expect(normalizeSeverity("low")).toBe("Low");
      expect(normalizeSeverity("info")).toBe("Info");
      expect(normalizeSeverity("unknown")).toBe("Medium");
    });
  });

  describe("normalizeReport", () => {
    it("normalizes a full report and ensures all 7 categories and 5 severities exist in summary", () => {
      const raw = {
        repository: "org/repo",
        analyzed_at: "2026-11-22T17:00:00Z",
        summary: {
          total_findings: 2,
          by_category: {
            linkability: 1,
            disclosure_of_information: 1,
          },
          by_severity: {
            critical: 1,
            medium: 1,
          },
        },
        findings: [
          {
            threat_id: "L1",
            category: "linkability",
            severity: "critical",
            target_type: "data_flow",
            component_id: "flow-1",
            component_name: "POST /login",
            title: "Linkable auth requests",
            description: "Session tokens are linkable across requests",
            gdpr_articles: ["Art. 4(1)", "Art. 32"],
            mitigation: "Use transient session tokens and rotating identifiers",
            source: "Client",
            target: "Auth Service",
          },
          {
            threat_id: "DI2",
            category: "disclosure_of_information",
            severity: "medium",
            target_type: "data_store",
            component_id: "db-1",
            component_name: "Users DB",
            title: "Unencrypted storage",
            description: "Personal data stored without column encryption",
            gdpr_articles: ["Art. 32"],
            mitigation: "Enable AES-256 field-level encryption",
            file_path: "storage/db.go",
          },
        ],
      };

      const report = normalizeReport(raw, "org/repo");
      expect(report.repository).toBe("org/repo");
      expect(report.summary.total_findings).toBe(2);
      expect(report.summary.by_category["Linkability"]).toBe(1);
      expect(report.summary.by_category["Disclosure of information"]).toBe(1);
      expect(report.summary.by_category["Identifiability"]).toBe(0);
      expect(report.summary.by_category["Non-compliance"]).toBe(0);
      expect(report.summary.by_severity["Critical"]).toBe(1);
      expect(report.summary.by_severity["Medium"]).toBe(1);
      expect(report.summary.by_severity["High"]).toBe(0);
      expect(report.findings).toHaveLength(2);

      const f1 = report.findings[0];
      expect(f1.threat_id).toBe("L1");
      expect(f1.category).toBe("Linkability");
      expect(f1.severity).toBe("Critical");
      expect(f1.component_name).toBe("POST /login");
      expect(f1.source).toBe("Client");
      expect(f1.target).toBe("Auth Service");

      const f2 = report.findings[1];
      expect(f2.threat_id).toBe("DI2");
      expect(f2.category).toBe("Disclosure of information");
      expect(f2.file_path).toBe("storage/db.go");
    });

    it("auto-generates summary from findings if summary is absent", () => {
      const raw = {
        findings: [
          {
            threat_id: "I1",
            category: "Identifiability",
            severity: "High",
            component_id: "c1",
            title: "PII leak",
            description: "PII exposed",
            gdpr_articles: ["Art. 5(1)(c)"],
            mitigation: "Redact identifiers",
          },
        ],
      };

      const report = normalizeReport(raw, "org/repo");
      expect(report.summary.total_findings).toBe(1);
      expect(report.summary.by_category["Identifiability"]).toBe(1);
      expect(report.summary.by_severity["High"]).toBe(1);
    });

    it("throws an error when raw data is not an object", () => {
      expect(() => normalizeReport(null, "org/repo")).toThrow("Invalid LINDDUN report format");
      expect(() => normalizeReport("string", "org/repo")).toThrow("Invalid LINDDUN report format");
    });
  });

  describe("fetchLinddunAnalysis HTTP error handling", () => {
    it("handles 400 Bad Request with LinddunApiError (code: INVALID_URL)", async () => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ detail: "Invalid git repository format" }),
      } as unknown as Response);

      await expect(
        fetchLinddunAnalysis("invalid-repo", { fetcher })
      ).rejects.toMatchObject({
        name: "LinddunApiError",
        status: 400,
        code: "INVALID_URL",
        message: "Invalid git repository format",
      });
    });

    it("handles 429 Rate Limit with LinddunApiError (code: RATE_LIMIT)", async () => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({ detail: "GitHub rate limit reached" }),
      } as unknown as Response);

      await expect(
        fetchLinddunAnalysis("org/repo", { fetcher })
      ).rejects.toMatchObject({
        name: "LinddunApiError",
        status: 429,
        code: "RATE_LIMIT",
      });
    });

    it("handles 503 Service Unavailable with LinddunApiError (code: SERVICE_BUSY)", async () => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({ detail: "Engine busy analyzing another repository" }),
      } as unknown as Response);

      await expect(
        fetchLinddunAnalysis("org/repo", { fetcher })
      ).rejects.toMatchObject({
        name: "LinddunApiError",
        status: 503,
        code: "SERVICE_BUSY",
      });
    });

    it("handles 404 Not Found with LinddunApiError (code: NOT_FOUND)", async () => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ detail: "Repository not found" }),
      } as unknown as Response);

      await expect(
        fetchLinddunAnalysis("org/repo", { fetcher })
      ).rejects.toMatchObject({
        name: "LinddunApiError",
        status: 404,
        code: "NOT_FOUND",
      });
    });

    it("handles network connection failure with LinddunApiError (code: NETWORK_ERROR)", async () => {
      const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(
        fetchLinddunAnalysis("org/repo", { fetcher })
      ).rejects.toMatchObject({
        name: "LinddunApiError",
        status: 0,
        code: "NETWORK_ERROR",
      });
    });

    it("successfully fetches, normalizes, and caches report", async () => {
      const mockPayload = {
        repository: "org/repo",
        analyzed_at: "2026-11-22T12:00:00Z",
        summary: {
          total_findings: 1,
          by_category: { Linkability: 1 },
          by_severity: { High: 1 },
        },
        findings: [
          {
            threat_id: "L1",
            category: "Linkability",
            severity: "High",
            target_type: "process",
            component_id: "auth",
            component_name: "Auth Service",
            title: "Linkable auth tokens",
            description: "Tokens can be correlated across sessions",
            gdpr_articles: ["Art. 4(1)", "Art. 25"],
            mitigation: "Rotate tokens per session",
          },
        ],
      };

      const fetcher = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      } as unknown as Response);

      const report = await fetchLinddunAnalysis("org/repo", { fetcher });
      expect(report.repository).toBe("org/repo");
      expect(report.summary.total_findings).toBe(1);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Verify cached
      const cached = peekLinddun("org/repo");
      expect(cached).not.toBeNull();
      expect(cached?.summary.total_findings).toBe(1);

      // Second call should return cached without fetcher call
      const report2 = await fetchLinddunAnalysis("org/repo", { fetcher });
      expect(report2).toBe(cached);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchLinddunCatalog", () => {
    it("returns catalog from backend if endpoint is available", async () => {
      const mockCat = {
        categories: { L: "Linkability", I: "Identifiability" },
        rules: [],
      };
      const fetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCat,
      } as unknown as Response);

      const cat = await fetchLinddunCatalog({ fetcher });
      expect(cat.categories).toBeDefined();
      expect(cat.categories.L).toBe("Linkability");
    });

    it("falls back to local catalog if backend fetch fails", async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error("Network error"));
      const cat = await fetchLinddunCatalog({ fetcher });
      expect(cat).toBeDefined();
      expect(cat.categories).toBeDefined();
    });
  });
});
