"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import type { TeamStats } from "@/lib/api/types";

type View = "commits" | "merge" | "activity";

const VIEWS: { id: View; label: string }[] = [
  { id: "commits", label: "Commits per week" },
  { id: "merge", label: "PR merge time" },
  { id: "activity", label: "Activity by day and hour" },
];

const MERGE_TARGET_HOURS = 8;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOUR_MARKS = [0, 6, 12, 18];

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function Bars({ values, labels, lineAt, limit, warnAbove, caption, unit }: {
  values: number[];
  labels: [string, string];
  lineAt: number;
  limit: number;
  warnAbove?: number;
  caption: string;
  unit: string;
}) {
  const top = Math.max(limit, ...values) * 1.18;
  return (
    <figure className="chart-figure">
      <div className="chart-plot" role="img" aria-label={`${caption}: ${values.join(", ")} ${unit}`}>
        <span className="chart-line" style={{ bottom: `${(lineAt / top) * 100}%` }} />
        {values.map((value, index) => (
          <span className="chart-column" key={index} title={`${value} ${unit}`}>
            <span
              className={warnAbove !== undefined && value > warnAbove ? "chart-bar warn" : "chart-bar"}
              style={{ height: `${(value / top) * 100}%` }}
            >
              <b>{warnAbove !== undefined && value > warnAbove ? `${value} !` : value}</b>
            </span>
          </span>
        ))}
      </div>
      <div className="chart-axis"><span>{labels[0]}</span><span>{labels[1]}</span></div>
      <figcaption className="chart-legend"><span className="chart-legend-line" aria-hidden="true" />{caption}</figcaption>
    </figure>
  );
}

function Heatmap({ punchCard }: { punchCard: number[][] }) {
  const peak = Math.max(1, ...punchCard.flat());
  return (
    <figure className="chart-figure">
      <div className="chart-heat" role="img" aria-label="Commits by day of the week and hour of the day">
        {DAY_ORDER.map((day) => (
          <div className="chart-heat-row" key={day}>
            <span className="chart-heat-day">{DAY_NAMES[day].slice(0, 3)}</span>
            {punchCard[day].map((value, hour) => (
              <span
                className="chart-heat-cell"
                key={hour}
                title={`${DAY_NAMES[day]} ${formatHour(hour)}: ${value} commits`}
                style={value ? { background: `color-mix(in srgb, var(--c-accent) ${Math.round(18 + (value / peak) * 82)}%, var(--c-surface))` } : undefined}
              />
            ))}
          </div>
        ))}
        <div className="chart-heat-row chart-heat-hours" aria-hidden="true">
          <span className="chart-heat-day" />
          {HOUR_MARKS.map((hour) => <span key={hour}>{formatHour(hour)}</span>)}
        </div>
      </div>
      <figcaption className="chart-legend">
        Less
        {[0, 25, 50, 75, 100].map((level) => (
          <span
            key={level}
            className="chart-heat-swatch"
            aria-hidden="true"
            style={{ background: level ? `color-mix(in srgb, var(--c-accent) ${level}%, var(--c-surface))` : undefined }}
          />
        ))}
        More
      </figcaption>
    </figure>
  );
}

function summarize(view: View, team: TeamStats) {
  if (view === "commits") {
    const weeks = team.weeklyCommits;
    const average = Math.round(weeks.reduce((sum, n) => sum + n, 0) / weeks.length);
    return `Average of ${average} commits per week over the last ${weeks.length} weeks. Busiest week: ${Math.max(...weeks)} commits.`;
  }
  if (view === "merge") {
    const prs = team.recentPrs;
    const average = prs.reduce((sum, pr) => sum + pr.hours, 0) / prs.length;
    const slow = prs.filter((pr) => pr.hours > MERGE_TARGET_HOURS).length;
    return `Average of ${average.toFixed(1)}h from opened to merged. ${slow} of the last ${prs.length} pull requests took more than ${MERGE_TARGET_HOURS}h.`;
  }
  const perDay = team.punchCard.map((hours) => hours.reduce((sum, n) => sum + n, 0));
  const perHour = Array.from({ length: 24 }, (_, hour) => team.punchCard.reduce((sum, day) => sum + day[hour], 0));
  return `Most commits land on ${DAY_NAMES[perDay.indexOf(Math.max(...perDay))]}s, around ${formatHour(perHour.indexOf(Math.max(...perHour)))}.`;
}

export function HygieneChart({ team }: { team: TeamStats }) {
  const [view, setView] = useState<View>("commits");

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = VIEWS[(VIEWS.findIndex((item) => item.id === view) + step + VIEWS.length) % VIEWS.length].id;
    setView(next);
    document.getElementById(`chart-tab-${next}`)?.focus();
  }

  const average = Math.round(team.weeklyCommits.reduce((sum, n) => sum + n, 0) / team.weeklyCommits.length);
  const firstPr = team.recentPrs[0].number;
  const lastPr = team.recentPrs[team.recentPrs.length - 1].number;

  return (
    <section className="hygiene-chart" aria-labelledby="hygiene-chart-title">
      <header className="hygiene-chart-header">
        <h4 id="hygiene-chart-title">Git activity</h4>
        <div className="chart-tabs" role="tablist" aria-label="Chart" onKeyDown={onKeyDown}>
          {VIEWS.map((item) => (
            <button
              key={item.id}
              id={`chart-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              aria-controls="hygiene-chart-panel"
              tabIndex={view === item.id ? 0 : -1}
              className={view === item.id ? "chart-tab active" : "chart-tab"}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div id="hygiene-chart-panel" role="tabpanel" aria-labelledby={`chart-tab-${view}`}>
        {view === "commits" && (
          <Bars
            values={team.weeklyCommits}
            labels={[`${team.weeklyCommits.length} weeks ago`, "This week"]}
            lineAt={average}
            limit={average}
            caption={`Average, ${average} commits per week`}
            unit="commits"
          />
        )}
        {view === "merge" && (
          <Bars
            values={team.recentPrs.map((pr) => pr.hours)}
            labels={[`PR #${firstPr}`, `PR #${lastPr}`]}
            lineAt={MERGE_TARGET_HOURS}
            limit={MERGE_TARGET_HOURS}
            warnAbove={MERGE_TARGET_HOURS}
            caption={`Hours to merge. Line marks ${MERGE_TARGET_HOURS}h; ! marks pull requests over it`}
            unit="hours"
          />
        )}
        {view === "activity" && <Heatmap punchCard={team.punchCard} />}
        <p className="chart-summary">{summarize(view, team)}</p>
      </div>
    </section>
  );
}
