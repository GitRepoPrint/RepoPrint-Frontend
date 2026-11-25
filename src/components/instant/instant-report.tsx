"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { HygieneGradeCard } from "@/components/score/score-parts";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-provider";
import { fileBaseName } from "@/lib/download";
import { printReport } from "@/lib/print";
import type { InstantReport as Report } from "@/lib/api/types";
import { useLinddun, type UseLinddunResult } from "@/linddun";
import { UnavailableFrameworkCard, UnavailablePanel } from "./unavailable-card";

export function InstantReport({
  report,
  linddunResult: externalLinddunResult,
}: {
  report: Report;
  linddunResult?: UseLinddunResult;
}) {
  const router = useRouter();
  const { authenticated } = useAuth();
  const git = { prMergeHours: report.prMergeHours, commitsPerMonth: report.commitsPerMonth };

  const internalLinddunResult = useLinddun(externalLinddunResult ? "" : report.repository);
  const linddun = externalLinddunResult ?? internalLinddunResult;
  const { report: linddunReport, status: linddunStatus, error: linddunError, refetch } = linddun;

  const threatList = useMemo(() => {
    return linddunReport?.threats || linddunReport?.findings || [];
  }, [linddunReport]);

  return (
    <section className="fingerprint-report" aria-labelledby="fingerprint-title">
      <div className="report-heading">
        <div className="report-title-group">
          <h2 id="fingerprint-title">Repository Fingerprint</h2>
          <div className="report-repo">
            <Icon name="github" size={18} />
            <strong>{report.repository}</strong>
            <span className="report-mono">SHA <b>N/A</b></span>
            <span className="report-branch"><Icon name="branch" size={14} /> {report.branch}</span>
          </div>
        </div>
        <div className="report-actions">
          <button type="button" className="button button-outline" onClick={() => printReport(`${fileBaseName(report.repository)}-audit-report`)}>
            <Icon name="download" size={16} /> Download Report
          </button>
        </div>
      </div>

      <div className="framework-cards">
        <UnavailableFrameworkCard label="THREAT MODELING · STRIDE" icon="warning" iconTone="red" />

        {linddunReport ? (
          <section className="report-panel framework-card">
            <div className="report-kpi-label">
              <span className="report-kpi-icon orange"><Icon name="lock" size={17} /></span> PRIVACY · LINDDUN / GDPR
            </div>
            <div className="report-kpi-value">{linddunReport.summary.total_findings} <small>Findings</small></div>
            <div className="report-kpi-foot">
              {Object.entries(linddunReport.summary.by_category)
                .filter(([, count]) => count > 0)
                .slice(0, 3)
                .map(([cat, count]) => (
                  <span key={cat} className="framework-card-tag">
                    <span className="framework-card-sep">·</span>
                    <span>{count} {cat}</span>
                  </span>
                ))}
            </div>

            <details className="framework-card-more">
              <summary aria-label="PRIVACY · LINDDUN / GDPR: show breakdown by category">
                <span className="report-kpi-detail">Breakdown by category</span>
                <span className="disclosure-pill"><span className="disclosure-icon"><Icon name="chevron" size={16} /></span></span>
              </summary>
              <ul className="category-chart-list">
                {Object.entries(linddunReport.summary.by_category).map(([cat, count]) => {
                  const max = Math.max(1, ...Object.values(linddunReport.summary.by_category));
                  return (
                    <li key={cat} className={count === 0 ? "is-empty" : undefined}>
                      <span className="category-chart-label">{cat}</span>
                      <span className="category-chart-track" aria-hidden="true">
                        <span className="category-chart-bar linddun" style={{ width: `${(count / max) * 100}%` }} />
                      </span>
                      <span className="category-chart-count">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>
        ) : linddunStatus === "loading" ? (
          <section className="report-panel framework-card">
            <div className="report-kpi-label">
              <span className="report-kpi-icon orange"><Icon name="lock" size={17} /></span> PRIVACY · LINDDUN / GDPR
            </div>
            <div className="report-kpi-value">... <small>Findings</small></div>
            <div className="report-kpi-foot">Analyzing privacy threats…</div>
          </section>
        ) : (
          <UnavailableFrameworkCard label="PRIVACY · LINDDUN / GDPR" icon="lock" iconTone="orange" />
        )}

        <HygieneGradeCard git={git} />
      </div>

      <section className="report-panel architecture-panel dfd-area">
        <div className="report-panel-heading">
          <div>
            <span className="section-kicker">SEMI-AUTOMATED DFD</span>
            <h3>Architecture preview</h3>
          </div>
          <span className="schema-preview">DFD · PREVIEW</span>
        </div>
        <UnavailablePanel message="The code of this repository has not been analyzed, so there is no diagram to show." />
      </section>

      <section className="report-panel threats-panel findings-area">
        <div className="report-panel-heading">
          <div>
            <span className="section-kicker">THREATS &amp; PRIVACY BREAKDOWN</span>
            <h3>Findings</h3>
          </div>
          <span className="findings-count">
            {linddunReport ? `${String(linddunReport.summary.total_findings).padStart(2, "0")} FINDINGS` : "N/A FINDINGS"}
          </span>
        </div>

        {linddunReport && threatList.length > 0 ? (
          <div className="threat-report-view">
            <div className="threat-report-table-wrap">
              <table className="formal-table formal-table-linddun">
                <thead>
                  <tr>
                    <th className="col-threat">Privacy Threat / Card</th>
                    <th className="col-component">Affected component</th>
                    <th className="col-hotspot">Hotspot</th>
                    <th className="col-source">Threat source</th>
                    <th className="col-desc">Description &amp; Consequences</th>
                  </tr>
                </thead>
                <tbody>
                  {threatList.map((finding, idx) => {
                    const id = `linddun-${finding.threat_id.toLowerCase()}-${finding.component_id}-${idx}`;
                    const compLabel = finding.component_name || finding.component_id || finding.target_type || "Component";
                    const fileLabel = finding.file_path || (finding.source && finding.target ? `${finding.source} -> ${finding.target}` : undefined);
                    const hotspot = finding.hotspot || "System";
                    const threatSources = finding.threat_sources && finding.threat_sources.length > 0 ? finding.threat_sources : ["Organizational"];

                    return (
                      <tr key={id}>
                        <td>
                          <strong>{finding.category}</strong>
                          {finding.title && finding.title !== finding.category && (
                            <div className="threat-report-context">
                              {finding.threat_id ? `[${finding.threat_id}] ` : ""}
                              {finding.title}
                            </div>
                          )}
                        </td>
                        <td>
                          {fileLabel ? <code>{fileLabel}</code> : null}
                          {fileLabel && compLabel ? " " : null}
                          {compLabel && (
                            <span className="threat-report-context">
                              {fileLabel ? `(${compLabel})` : compLabel}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="threat-report-hotspot-badge">{hotspot}</span>
                        </td>
                        <td>
                          <div className="threat-report-tags">
                            {threatSources.map((source) => (
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
                          {finding.consequences && finding.consequences.length > 0 && (
                            <div className="threat-report-context" style={{ marginTop: "4px" }}>
                              {finding.consequences[0]}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : linddunStatus === "loading" ? (
          <div className="repo-empty">
            <span className="analysis-spinner large" style={{ margin: "0 auto 12px" }} />
            <strong>Analyzing privacy threats</strong>
            <p>Evaluating LINDDUN GO rules for {report.repository}…</p>
          </div>
        ) : linddunStatus === "error" ? (
          <div className="repo-empty">
            <strong>Threat analysis unavailable</strong>
            <p>{linddunError instanceof Error ? linddunError.message : "Failed to load threat analysis"}</p>
            <button type="button" className="button button-outline" style={{ marginTop: "12px" }} onClick={refetch}>
              Retry analysis
            </button>
          </div>
        ) : (
          <UnavailablePanel message="The code of this repository has not been analyzed, so there are no findings to show." />
        )}
      </section>

      {!authenticated && (
        <div className="report-cta">
          <span className="report-cta-icon"><Icon name="lock" size={20} /></span>
          <p>State-free analysis completed. Long-term metric persistence, commit history, private repository auditing, and manual DFD editing on the canvas require an authenticated session.</p>
          <button type="button" className="button button-primary" onClick={() => router.push("/login")}>
            Sign In <Icon name="arrowRight" size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
