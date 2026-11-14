"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { ScanSummary } from "@/lib/api/types";

type DashboardHeaderProps = {
  repository: string;
  /** Só os repositórios de demonstração têm varrimentos, ramos e histórico (de exemplo). */
  demo: boolean;
  lastScanned: string;
  branches: string[];
  branch: string;
  onBranchChange: (branch: string) => void;
  scans: ScanSummary[];
  scanId: string;
  onScanChange: (id: string) => void;
  onBack: () => void;
  onScan: () => void;
  onExport: () => void;
};

export function DashboardHeader(p: DashboardHeaderProps) {
  const [branchOpen, setBranchOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora ou com Escape.
  useEffect(() => {
    if (!branchOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setBranchOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setBranchOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [branchOpen]);

  return (
    <div className="dashboard-heading">
      <div className="dashboard-heading-primary">
        <h1 className="dashboard-repository-title">
          <button type="button" className="dashboard-back-button" aria-label="Back to repositories" title="Back to repositories" onClick={p.onBack}>
            <Icon name="arrow" size={18} />
          </button>
          <Icon name="github" size={25} /> <span>{p.repository}</span>
        </h1>
        <div className="dashboard-heading-actions">
          <div className="dashboard-action-buttons">
            {p.demo && (
              <div className="scan-action">
                <button type="button" className="button button-primary scan-now" onClick={p.onScan}><Icon name="spark" size={16} /> Scan Now</button>
                <span className="scan-time">Last scanned {p.lastScanned}</span>
              </div>
            )}
            {p.demo && (
              <button type="button" className="button button-outline export-report" onClick={p.onExport}>
                <Icon name="download" size={17} /> Export PDF Report
              </button>
            )}
          </div>
        </div>
      </div>
      {p.demo && <div className="dashboard-controls">
        <div className="dropdown-wrap" ref={wrapRef}>
          <button type="button" className="branch-button" aria-haspopup="menu" aria-expanded={branchOpen} onClick={() => setBranchOpen((open) => !open)}>
            <Icon name="branch" size={14} /> {p.branch} <Icon name="chevron" size={13} />
          </button>
          {branchOpen && (
            <div className="dropdown-menu branch-menu" role="menu">
              {p.branches.map((item) => (
                <button key={item} type="button" role="menuitem" onClick={() => { p.onBranchChange(item); setBranchOpen(false); }}>
                  {item}{p.branch === item && <Icon name="check" size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="analysis-history-controls">
          <label>
            <span>Analysis history</span>
            <select aria-label="Recent analysis history" value={p.scanId} onChange={(event) => p.onScanChange(event.target.value)}>
              {p.scans.map((scan) => <option key={scan.id} value={scan.id}>{scan.label}</option>)}
            </select>
          </label>
        </div>
      </div>}
    </div>
  );
}
