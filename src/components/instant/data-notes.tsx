import { activityNotes } from "@/lib/activity-notes";
import type { NoteOptions } from "@/lib/activity-notes";
import type { ActivityInfo } from "@/lib/api/types";

type DataNotesProps = {
  activity: ActivityInfo;
  commitsPerMonth: number;
  mergeHours: number | null;
  options?: NoteOptions;
};

export function DataNotes({ activity, commitsPerMonth, mergeHours, options }: DataNotesProps) {
  const rows= activityNotes(activity, commitsPerMonth, mergeHours, options);
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
