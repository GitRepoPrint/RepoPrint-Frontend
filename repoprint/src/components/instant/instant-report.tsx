"use client";

import { useRouter } from "next/navigation";
import { DfdPreview } from "@/components/dfd/dfd-preview";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-provider";
import { printReport } from "@/lib/print";
import type { Finding, InstantReport as Report, Severity } from "@/lib/api/types";

const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

function ThreatRow({ finding: f }: { finding: Finding }) {
  return (
    <article className="threat-row">
      <div className="threat-finding-content">
        <div className="threat-meta">
          <span className="threat-category">{f.framework} · {f.category.toUpperCase()}</span>
          <span className={`finding-severity-badge ${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
        </div>
        <div className="threat-component"><code>{f.file}</code> · {f.location}</div>
        <p className="threat-risk-impact"><strong>{f.title}</strong><span>{f.impact}</span></p>
        {/* classe herdada do mockup (.slm-recommendation); o conteúdo já é texto estático */}
        <div className="slm-recommendation"><span>Mitigation:</span><em>{f.mitigation}</em></div>
        <div className="finding-regulatory-tags">
          {f.regulatoryTags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </div>
    </article>
  );
}

export function InstantReport({ report }: { report: Report }) {
  const router = useRouter();
  const { authenticated } = useAuth();
  const { summary, findings } = report;

  return (
    <section className="fingerprint-report" aria-labelledby="fingerprint-title">
      <div className="report-heading">
        <div className="report-title-group">
          <h2 id="fingerprint-title" className="text-[#f4f4f5]! [.theme-light_&]:text-[#282a3b]!">Repository Fingerprint</h2>
          <div className="report-repo">
            <Icon name="github" size={17} />
            <strong className="text-[#f0eef8]! [.theme-light_&]:text-[#303246]!">{report.repository}</strong>
            <span className="report-mono text-[#a1a1aa]! [.theme-light_&]:text-[#6f7381]!">SHA <b className="text-[#e4e4e7]! [.theme-light_&]:text-[#42385e]!">{report.commit}</b></span>
            <span className="report-branch"><Icon name="branch" size={13} /> {report.branch}</span>
          </div>
        </div>
        <div className="report-actions">
          <button type="button" className="button button-outline" onClick={() => printReport(`${report.repository.replace("/", "-")}-audit-report`)}>
            <Icon name="download" size={16} /> Download Report
          </button>
        </div>
      </div>

      <div className="report-kpis">
        <article className="report-kpi">
          <div className="report-kpi-label"><span className="report-kpi-icon red"><Icon name="warning" size={17} /></span> THREAT MODELING · STRIDE</div>
          <div className="report-kpi-value">{summary.stride.findings} <small>Findings</small></div>
          <div className="report-kpi-foot">
            <span className="severity-high">{summary.stride.high} High</span><span>·</span>
            <span className="severity-medium">{summary.stride.medium} Medium</span>
          </div>
          <p className="report-kpi-detail">{summary.stride.detail}</p>
        </article>
        <article className="report-kpi">
          <div className="report-kpi-label"><span className="report-kpi-icon orange"><Icon name="lock" size={17} /></span> PRIVACY · LINDDUN / GDPR</div>
          <div className="report-kpi-value">{summary.privacy.highRisks} <small>High Risks</small></div>
          <div className="report-kpi-foot"><span className="severity-high">{summary.privacy.labels}</span></div>
          <p className="report-kpi-detail">{summary.privacy.detail}</p>
        </article>
        <article className="report-kpi">
          <div className="report-kpi-label"><span className="report-kpi-icon blue"><Icon name="branch" size={17} /></span> GIT INTELLIGENCE &amp; HYGIENE</div>
          <div className="report-kpi-value">{summary.git.grade} <small>Grade</small></div>
          <div className="report-kpi-foot">
            PR merge <strong>{summary.git.prMergeHours}h</strong><span>·</span>
            <strong>{summary.git.commitsPerMonth}</strong> commits / month
          </div>
          <p className="report-kpi-detail">{summary.git.codeOwnersCoverage}% Code Owners coverage</p>
        </article>
      </div>

      <div className="report-details">
        <section className="report-panel threats-panel">
          <div className="report-panel-heading">
            <div>
              <span className="section-kicker">THREATS &amp; PRIVACY BREAKDOWN</span>
              <h3>Findings &amp; recommended fixes</h3>
            </div>
            <span className="findings-count">{String(findings.length).padStart(2, "0")} FINDINGS</span>
          </div>
          {findings.map((finding) => <ThreatRow key={finding.id} finding={finding} />)}
        </section>

        <section className="report-panel architecture-panel">
          <div className="report-panel-heading">
            <div>
              <span className="section-kicker">SEMI-AUTOMATED DFD</span>
              <h3>Architecture preview</h3>
            </div>
            <span className="schema-preview">DFD · PREVIEW</span>
          </div>
          <DfdPreview />
        </section>
      </div>

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
