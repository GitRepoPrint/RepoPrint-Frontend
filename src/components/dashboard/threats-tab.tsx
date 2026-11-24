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

  // Secção LINDDUN preenchida com as cartas e dados oficiais do LINDDUN GO
  const linddunRows = useMemo(() => {
    // 1. Dados reais vindos do endpoint GET /linddun do backend ou motor LINDDUN GO
    const threatList = linddunReport?.threats || linddunReport?.findings;
    if (threatList && threatList.length > 0) {
      return threatList.map((f, idx) => {
        const id = `linddun-${f.threat_id.toLowerCase()}-${f.component_id}-${idx}`;
        const compLabel = f.component_name || f.component_id || f.target_type || "Component";
        const fileLabel = f.file_path || (f.source && f.target ? `${f.source} -> ${f.target}` : undefined);
        const hotspot = f.hotspot || "System";
        const threatSources = f.threat_sources && f.threat_sources.length > 0 ? f.threat_sources : ["Organizational"];

        return {
          id,
          threatId: f.threat_id,
          category: f.category,
          title: f.title,
          description: f.description,
          hotspot,
          threatSources,
          elicitationQuestions: f.elicitation_questions || [],
          consequences: f.consequences || [],
          examples: f.examples || [],
          additionalInfo: f.additional_info || "",
          file: fileLabel,
          component: compLabel,
        };
      });
    }

    // 2. Findings LINDDUN da análise (fallback)
    const repoLinddun = findings.filter((f) => f.framework === "LINDDUN");
    if (repoLinddun.length > 0) {
      return repoLinddun.map((f, idx) => {
        return {
          id: f.id || `linddun-${idx}`,
          threatId: f.ref || "",
          category: f.category,
          title: f.title,
          description: f.impactDetail || f.title,
          hotspot: f.topic || "Inbound User With Personal Data",
          threatSources: ["Organizational"],
          elicitationQuestions: [],
          consequences: [],
          examples: [],
          additionalInfo: "",
          file: f.file !== "system" ? f.file : undefined,
          component: f.component,
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

      {/* 03 Privacy Risk Assessment (LINDDUN GO) */}
      <section className="formal-report-section">
        <div className="formal-section-title">
          <span>03</span>
          <h2>Privacy Threat Modeling (LINDDUN GO)</h2>
        </div>
        <div className="threat-report-table-wrap">
          <table className="formal-table">
            <thead>
              <tr>
                <th>Privacy Threat / Card</th>
                <th>Affected component</th>
                <th>Hotspot</th>
                <th>Threat source</th>
                <th>Description &amp; Consequences</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {linddunRows.length > 0 ? (
                linddunRows.map((finding) => {
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
                      <td>
                        <span className="threat-report-hotspot-badge">{finding.hotspot}</span>
                      </td>
                      <td>
                        <div className="threat-report-tags">
                          {finding.threatSources.map((source) => (
                            <span className="threat-report-tag" key={source}>
                              {source}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="threat-report-desc">
                          {finding.description}
                        </div>
                        {finding.consequences.length > 0 && (
                          <div className="threat-report-context" style={{ marginTop: "4px" }}>
                            {finding.consequences[0]}
                          </div>
                        )}
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
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px 16px", color: "var(--c-text-2, #71717a)" }}>
                    No LINDDUN privacy threat modeling findings available.
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
