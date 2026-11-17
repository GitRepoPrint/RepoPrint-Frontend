import type { ReactNode } from "react";
import { ProgressRing } from "./progress-ring";

export type LoadingStep = { label: string; state: "done" | "active" | "todo" };

type LoadingPanelProps = {
  title: string;
  /** Uma linha por baixo do título: o que se está a fazer agora (e quanto já foi). */
  detail?: string;
  /** De 0 a 1; sem valor, a roda gira sem percentagem. */
  progress?: number | null;
  steps?: LoadingStep[];
  /** Uma nota por baixo, por exemplo que um repositório grande demora mais. */
  note?: ReactNode;
  className?: string;
};

/** Uma espera com a roda de progresso, o que se está a fazer e, se se souber, as fases (feitas, a decorrer e por fazer). */
export function LoadingPanel({ title, detail, progress, steps, note, className = "" }: LoadingPanelProps) {
  return (
    <div className={`loading-panel ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <ProgressRing value={progress} size={88} label={title} />
      <div className="loading-panel-text">
        <strong>{title}</strong>
        {detail && <span className="loading-panel-detail">{detail}</span>}
        {steps && steps.length > 0 && (
          <ol className="loading-panel-steps" aria-label="Steps">
            {steps.map((step) => (
              <li key={step.label} className={step.state} aria-current={step.state === "active" ? "step" : undefined}>
                <span className="loading-panel-mark" aria-hidden="true">{step.state === "done" ? "✓" : ""}</span>
                {step.label}
              </li>
            ))}
          </ol>
        )}
        {note && <span className="loading-panel-note">{note}</span>}
      </div>
    </div>
  );
}
