// A roda de progresso: um anel que se vai enchendo (como a da App Store), sem número: só o anel. Sem `value` é uma roda a girar:
// quando não se sabe quanto falta. A percentagem só existe para quem usa um leitor de ecrã (aria-valuenow). Serve para qualquer espera; o que muda é o `value` (de 0 a 1) e o texto à volta.

const RADIUS = 44;
export const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type ProgressRingProps = {
  /** De 0 a 1. Sem valor (ou null) é uma roda a girar, sem percentagem. */
  value?: number | null;
  /** Lado em píxeis. */
  size?: number;
  /** O que se está a esperar, para quem usa um leitor de ecrã. */
  label: string;
  className?: string;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export function ProgressRing({ value, size = 64, label, className = "" }: ProgressRingProps) {
  const known = typeof value === "number" && Number.isFinite(value);
  const fraction = known ? clamp(value) : 0;
  const percent = Math.round(fraction * 100);

  return (
    <div
      className={`progress-ring ${known ? "" : "indeterminate"} ${className}`.trim()}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? percent : undefined}
      aria-valuetext={known ? `${percent}%` : "In progress"}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="progress-ring-track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="progress-ring-fill"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={known ? CIRCUMFERENCE * (1 - fraction) : CIRCUMFERENCE * 0.72}
        />
      </svg>
    </div>
  );
}
