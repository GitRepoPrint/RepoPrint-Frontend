"use client";

import { useMemo } from "react";
import type { Finding, RepositoryAnalysis } from "@/lib/api/types";
import type { NodeRisk } from "@/lib/findings";
import type { LinddunReport } from "@/linddun";

export type ThreatsTabProps = {
  analysis: RepositoryAnalysis;
  linddunReport?: LinddunReport | null;
  risks?: NodeRisk[];
  nodeId?: string;
  reasons?: Record<string, string>;
  onTriage?: (finding: Finding) => void;
  onSelectNode?: (id: string) => void;
  onShowInDiagram?: (id: string) => void;
};

export function ThreatsTab({
  analysis,
  linddunReport,
}: ThreatsTabProps) {
  const { findings } = analysis;

  // Apenas a secção de LINDDUN é preenchida dinamicamente com dados reais do motor LINDDUN
  const linddunRows = useMemo(() => {
    // 1. Dados reais vindos do endpoint GET /linddun do backend
    if (linddunReport?.findings && linddunReport.findings.length > 0) {
      return linddunReport.findings.map((f, idx) => {
        const id = `linddun-${f.threat_id.toLowerCase()}-${f.component_id}-${idx}`;
        const compLabel = f.component_name || f.component_id || f.target_type || "Component";
        const fileLabel = f.file_path || (f.source && f.target ? `${f.source} -> ${f.target}` : undefined);
        const sevLower = f.severity.toLowerCase();
        const articles = (f.gdpr_articles || []).map((art) => {
          const cleaned = art.replace(/^GDPR\s+/, "");
          return cleaned.startsWith("Art.") ? cleaned : `Art. ${cleaned}`;
        });

        const rawFinding: Finding = {
          id,
          ref: f.threat_id,
          framework: "LINDDUN",
          category: f.category,
          severity: sevLower === "critical" || sevLower === "high" ? "high" : sevLower === "medium" ? "medium" : "low",
          component: compLabel,
          file: fileLabel || "system",
          location: f.source && f.target ? `${f.source} to ${f.target}` : compLabel,
          title: f.title,
          impact: f.title,
          impactDetail: f.description,
          exposure: {
            impact: sevLower === "critical" || sevLower === "high" ? "high" : sevLower === "medium" ? "medium" : "low",
            impactLabel: f.category.toLowerCase(),
            probability: sevLower === "critical" || sevLower === "high" ? "high" : sevLower === "medium" ? "medium" : "low",
          },
          effort: { level: "low", estimate: "~4 hours" },
          topic: f.category,
          mitigation: f.mitigation,
          regulatoryTags: articles,
        };

        return {
          id,
          threatId: f.threat_id,
          category: f.category,
          title: f.title,
          description: f.description,
          file: fileLabel,
          component: compLabel,
          severity: f.severity,
          articles,
          raw: rawFinding,
        };
      });
    }

    // 2. Findings LINDDUN da análise (se existirem)
    const repoLinddun = findings.filter((f) => f.framework === "LINDDUN");
    if (repoLinddun.length > 0) {
      return repoLinddun.map((f) => {
        const articles = f.regulatoryTags.map((art) => {
          const cleaned = art.replace(/^GDPR\s+/, "");
          return cleaned.startsWith("Art.") ? cleaned : `Art. ${cleaned}`;
        });
        return {
          id: f.id,
          threatId: f.ref,
          category: f.category,
          title: f.title,
          description: f.impactDetail,
          file: f.file !== "system" ? f.file : undefined,
          component: f.component,
          severity: f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
          articles,
          raw: f,
        };
      });
    }

    return [];
  }, [linddunReport, findings]);

  return (
    <div className="threat-report-view">
      {/* 01 Executive Summary & Risk Overview (sem dados mock) */}
      <section className="formal-report-section">
        <div className="formal-section-title">
          <span>01</span>
          <h2>Executive Summary &amp; Risk Overview</h2>
        </div>
        <div className="threat-report-summary">
          <p style={{ color: "var(--c-text-2, #71717a)" }}>
            No executive summary available.
          </p>
        </div>
        <div className="threat-report-table-wrap">
          <table className="formal-table">
            <thead>
              <tr>
                <th>Component / File</th>
                <th>Risk</th>
                <th>Impact</th>
                <th>Probability</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "28px 16px", color: "var(--c-text-2, #71717a)" }}>
                  No risk overview data available.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 02 Threat Modeling Findings (STRIDE) (sem dados mock) */}
      <section className="formal-report-section">
        <div className="formal-section-title">
          <span>02</span>
          <h2>Threat Modeling Findings (STRIDE)</h2>
        </div>
        <div className="threat-report-table-wrap">
          <table className="formal-table">
            <thead>
              <tr>
                <th>Threat</th>
                <th>Affected file / flow</th>
                <th className="threat-report-severity-cell">Severity</th>
                <th>Impact</th>
                <th>Regulatory controls</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "32px 16px", color: "var(--c-text-2, #71717a)" }}>
                  No STRIDE threat modeling findings available.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 03 Privacy Risk Assessment (LINDDUN) (preenchido com dados reais de privacidade LINDDUN) */}
      <section className="formal-report-section">
        <div className="formal-section-title">
          <span>03</span>
          <h2>Privacy Risk Assessment (LINDDUN)</h2>
        </div>
        <div className="threat-report-table-wrap">
          <table className="formal-table">
            <thead>
              <tr>
                <th>Privacy risk</th>
                <th>Affected component</th>
                <th className="threat-report-severity-cell">Severity</th>
                <th>Applicable GDPR articles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {linddunRows.length > 0 ? (
                linddunRows.map((finding) => {
                  const sevLower = finding.severity.toLowerCase();
                  const sevClass =
                    sevLower === "critical" || sevLower === "high"
                      ? "high"
                      : sevLower === "medium"
                        ? "medium"
                        : "low";

                  return (
                    <tr key={finding.id}>
                      <td>
                        <strong>{finding.category}</strong>
                        {finding.title && finding.title !== finding.category && (
                          <div className="threat-report-context">
                            {finding.threatId ? `[${finding.threatId}] ` : ""}
                            {finding.title}
                          </div>
                        )}
                      </td>
                      <td>
                        {finding.file ? <code>{finding.file}</code> : null}
                        {finding.file && finding.component ? " " : null}
                        {finding.component && (
                          <span className="threat-report-context">
                            {finding.file ? `(${finding.component})` : finding.component}
                          </span>
                        )}
                      </td>
                      <td className="threat-report-severity-cell">
                        <span className={`threat-report-severity ${sevClass}`}>{finding.severity}</span>
                      </td>
                      <td>
                        <div className="threat-report-tags">
                          {finding.articles.map((article) => (
                            <span className="threat-report-tag" key={article}>
                              {article}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="threat-report-action-cell">
                        <button
                          type="button"
                          className="threat-report-action disabled"
                          disabled
                          title="Not available yet"
                        >
                          Mark as False Positive
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px 16px", color: "var(--c-text-2, #71717a)" }}>
                    No privacy risk findings available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 06 AI-Assisted Mitigations (SLM Recommendations) */}
      <section className="formal-report-section">
        <div className="formal-section-title">
          <span>06</span>
          <h2>AI-Assisted Mitigations (SLM Recommendations)</h2>
        </div>
        <div className="threat-report-summary" style={{ margin: 0 }}>
          <p style={{ color: "var(--c-text-2, #71717a)" }}>Not available</p>
        </div>
      </section>
    </div>
  );
}
