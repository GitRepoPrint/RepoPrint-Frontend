"use client";

import { useRouter } from "next/navigation";
import { HygieneGradeCard } from "@/components/score/score-parts";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-provider";
import { fileBaseName } from "@/lib/download";
import { printReport } from "@/lib/print";
import type { InstantReport as Report } from "@/lib/api/types";
import { UnavailableFrameworkCard, UnavailablePanel } from "./unavailable-card";

export function InstantReport({ report }: { report: Report }) {
  const router = useRouter();
  const { authenticated } = useAuth();
  const git = { prMergeHours: report.prMergeHours, commitsPerMonth: report.commitsPerMonth };

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
        <UnavailableFrameworkCard label="PRIVACY · LINDDUN / GDPR" icon="lock" iconTone="orange" />
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
          <span className="findings-count">N/A FINDINGS</span>
        </div>
        <UnavailablePanel message="The code of this repository has not been analyzed, so there are no findings to show." />
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
