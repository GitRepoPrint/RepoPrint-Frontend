import { SEVERITY_LABEL } from "@/lib/findings";
import type { Effort } from "@/lib/api/types";

export function EffortLabel({ effort }: { effort: Effort }) {
  return (
    <span className="effort">
      <span className={`effort-level ${effort.level}`}>
        <i aria-hidden="true">{[0, 1, 2].map((bar) => <b key={bar} className={bar <= ["low", "medium", "high"].indexOf(effort.level) ? "on" : undefined} />)}</i>
        {SEVERITY_LABEL[effort.level]}
      </span>
      <span className="effort-estimate">{effort.estimate}</span>
    </span>
  );
}

export const effortText = (effort: Effort) => `${SEVERITY_LABEL[effort.level]} · ${effort.estimate}`;
