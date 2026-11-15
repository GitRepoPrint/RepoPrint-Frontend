import type { ReactNode } from "react";

export type PendingSubject= "threats" | "dfd";

const COPY: Record<PendingSubject, { label: string; title: string; text: string }>= {
  threats: {
    label: "Threat Modeling and Architectural Posture",
    title: "Threat modeling is not available yet",
    text: "Threats and privacy risks come from the code analysis, which is not available yet. No findings, risk levels or scores are shown for this repository, so nothing here is estimated.",
  },
  dfd: {
    label: "Inferred Architecture and Data Flow Diagram",
    title: "The data flow diagram is not available yet",
    text: "The diagram is rebuilt from the source code and infrastructure files by the code analysis, which is not available yet. No diagram is drawn for this repository, so nothing here is guessed.",
  },
};

export function CodeAnalysisPending({ subject, children }: { subject: PendingSubject; children?: ReactNode }) {
  const { label, title, text }= COPY[subject];
  return (
    <section className="dashboard-section team-page" aria-label={label}>
      <section className="team-box" aria-labelledby={`pending-${subject}-title`}>
        <header className="team-box-header">
          <div>
            <h3 id={`pending-${subject}-title`}>{title}</h3>
            <p>{text}</p>
          </div>
          <span className="team-chip neutral">Not available yet</span>
        </header>
        {children}
      </section>
    </section>
  );
}
