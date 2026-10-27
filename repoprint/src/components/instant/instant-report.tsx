"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DfdPreview } from "@/components/dfd/dfd-preview";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-provider";
import { printReport } from "@/lib/print";
import { byFramework, LINDDUN_CATEGORIES, SEVERITY_LABEL, STRIDE_CATEGORIES } from "@/lib/findings";
import type { Finding, InstantReport as Report } from "@/lib/api/types";
import { FindingModal } from "./finding-modal";
import { FrameworkCard } from "./framework-card";

function FindingCard({ finding: f, onOpen }: { finding: Finding; onOpen: () => void }) {
  return (
    <article className="finding-card">
      <span className={`finding-severity-badge ${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
      <span className="finding-card-category">{f.framework} · {f.category.toUpperCase()}</span>
      <strong className="finding-card-title">{f.title}</strong>
      <code className="finding-card-file">{f.file}</code>
      <button type="button" className="finding-details-button" onClick={onOpen}>
        Details <Icon name="arrowRight" size={13} />
      </button>
    </article>
  );
}

export function InstantReport({ report }: { report: Report }) {
  const router = useRouter();
  const { authenticated } = useAuth();
  const [selected, setSelected] = useState<Finding | null>(null);
  const { summary, findings } = report;
  const stride = byFramework(findings, "STRIDE");
  const linddun = byFramework(findings, "LINDDUN");

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

      <div className="framework-cards">
        <FrameworkCard
          label="THREAT MODELING · STRIDE"
          icon="warning"
          iconTone="red"
          tone="stride"
          detail={summary.stride.detail}
          categories={STRIDE_CATEGORIES}
          findings={stride}
        />
        <FrameworkCard
          label="PRIVACY · LINDDUN / GDPR"
          icon="lock"
          iconTone="orange"
          tone="linddun"
          detail={summary.privacy.detail}
          categories={LINDDUN_CATEGORIES}
          findings={linddun}
        />
        <article className="report-kpi git-kpi">
          <div className="report-kpi-label"><span className="report-kpi-icon blue"><Icon name="branch" size={17} /></span> GIT INTELLIGENCE &amp; HYGIENE</div>
          <div className="report-kpi-value">{summary.git.grade} <small>Grade</small></div>
          <div className="report-kpi-foot">
            PR merge <strong>{summary.git.prMergeHours}h</strong><span>·</span>
            <strong>{summary.git.commitsPerMonth}</strong> commits / month
          </div>
          <p className="report-kpi-detail">{summary.git.codeOwnersCoverage}% Code Owners coverage</p>
        </article>
      </div>

      <section className="report-panel architecture-panel dfd-area">
        <div className="report-panel-heading">
          <div>
            <span className="section-kicker">SEMI-AUTOMATED DFD</span>
            <h3>Architecture preview</h3>
          </div>
          <span className="schema-preview">DFD · PREVIEW</span>
        </div>
        <DfdPreview />
      </section>

      <section className="report-panel threats-panel findings-area">
        <div className="report-panel-heading">
          <div>
            <span className="section-kicker">THREATS &amp; PRIVACY BREAKDOWN</span>
            <h3>Findings</h3>
          </div>
          <span className="findings-count">{String(findings.length).padStart(2, "0")} FINDINGS</span>
        </div>
        <div className="finding-cards">
          {findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} onOpen={() => setSelected(finding)} />
          ))}
        </div>
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

      {selected && <FindingModal finding={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
