"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-provider";
import { fileBaseName } from "@/lib/download";
import { printReport } from "@/lib/print";
import type { InstantReport as Report } from "@/lib/api/types";
import { DataNotes } from "./data-notes";

export function InstantReport({ report }: { report: Report }) {
  const router = useRouter();
  const { authenticated } = useAuth();

  return (
    <section className="fingerprint-report" aria-labelledby="fingerprint-title">
      <div className="report-heading">
        <div className="report-title-group">
          <h2 id="fingerprint-title">Repository Fingerprint</h2>
          <div className="report-repo">
            <Icon name="github" size={18} />
            <strong>{report.repository}</strong>
            <span className="report-branch"><Icon name="branch" size={14} /> {report.branch}</span>
          </div>
        </div>
        <div className="report-actions">
          <button type="button" className="button button-outline" onClick={() => printReport(`${fileBaseName(report.repository)}-audit-report`)}>
            <Icon name="download" size={16} /> Download Report
          </button>
        </div>
      </div>

      <DataNotes activity={report.activity} commitsPerMonth={report.commitsPerMonth} mergeHours={report.prMergeHours} />

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
