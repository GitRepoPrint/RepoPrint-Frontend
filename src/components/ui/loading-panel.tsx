import { ProgressRing } from "./progress-ring";

type LoadingPanelProps = {
  title: string;
  /** Uma linha por baixo do título: o que se está a fazer agora (e quanto já foi). */
  detail?: string;
  /** De 0 a 1; sem valor, a roda gira. */
  progress?: number | null;
  className?: string;
};

/** Uma espera discreta: a roda (que se enche, ou gira se não se sabe quanto falta), o título e uma linha do que se está a fazer. */
export function LoadingPanel({ title, detail, progress, className = "" }: LoadingPanelProps) {
  return (
    <div className={`loading-panel ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <ProgressRing value={progress} size={52} label={title} />
      <div className="loading-panel-text">
        <strong>{title}</strong>
        {detail && <span className="loading-panel-detail">{detail}</span>}
      </div>
    </div>
  );
}
