import { activityNotes } from "@/lib/activity-notes";
import type { ActivityInfo } from "@/lib/api/types";

type DataNotesProps = {
  activity: ActivityInfo;
  commitsPerMonth: number;
  mergeHours: number | null;
};

export function DataNotes({ activity, commitsPerMonth, mergeHours }: DataNotesProps) {
  const rows= activityNotes(activity, commitsPerMonth, mergeHours);
  return (
    <section className="report-panel data-notes-panel" aria-labelledby="data-notes-title">
      <div className="report-panel-heading">
        <div>
          <span className="section-kicker">GIT DATA</span>
          <h3 id="data-notes-title">How these numbers are measured</h3>
        </div>
      </div>
      <dl className="data-notes">
        {rows.map((row) => (
          <div key={row.metric}>
            <dt>{row.metric}</dt>
            <dd><strong>{row.value}</strong><span>{row.rule}</span></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
