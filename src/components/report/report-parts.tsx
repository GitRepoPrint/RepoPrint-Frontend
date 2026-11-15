import Image from "next/image";
import type { ReactNode } from "react";
import lightLogo from "@/assets/logos/logo_final.png";

// Peças do relatório formal. O relatório completo da plataforma (mais tarde) reutiliza-as.

type ReportHeaderProps = {
  repository: string;
  branch: string;
  commit: string;
  date: string;
};

export function ReportHeader({ repository, branch, commit, date }: ReportHeaderProps) {
  return (
    <header className="formal-report-header">
      {/* eager: o relatório está display:none no ecrã e uma imagem "lazy" escondida não chegaria a carregar antes de imprimir */}
      <Image src={lightLogo} alt="RepoPrint" loading="eager" />
      <div className="formal-report-kicker">SECURITY &amp; PRIVACY ASSESSMENT</div>
      <h1 id="formal-report-title">Repository Security &amp; Privacy Audit Report</h1>
      <dl className="report-metadata">
        <div><dt>Repository</dt><dd>{repository}</dd></div>
        <div><dt>Branch</dt><dd>{branch}</dd></div>
        <div><dt>Commit Hash</dt><dd>{commit}</dd></div>
        <div><dt>Analysis Date</dt><dd>{date}</dd></div>
      </dl>
    </header>
  );
}

type ReportSectionProps = {
  number: string;
  title: string;
  className?: string;
  children: ReactNode;
};

export function ReportSection({ number, title, className, children }: ReportSectionProps) {
  return (
    <section className={["formal-report-section", className].filter(Boolean).join(" ")}>
      <div className="formal-section-title"><span>{number}</span><h2>{title}</h2></div>
      {children}
    </section>
  );
}

export function ReportFooter({ date }: { date: string }) {
  return (
    <footer className="formal-report-footer">
      <span>RepoPrint · Repository Security &amp; Privacy Audit</span>
      <span>Generated {date} · Findings require owner validation</span>
    </footer>
  );
}
