import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";

type UnavailableCardProps = { label: string; icon: IconName; iconTone: "red" | "orange" };

export function UnavailableFrameworkCard({ label, icon, iconTone }: UnavailableCardProps) {
  return (
    <section className="report-panel framework-card">
      <div className="report-kpi-label">
        <span className={`report-kpi-icon ${iconTone}`}><Icon name={icon} size={17} /></span> {label}
      </div>
      <div className="report-kpi-value">N/A <small>Findings</small></div>
      <div className="report-kpi-foot">Code analysis not available yet</div>
    </section>
  );
}

export function UnavailablePanel({ message }: { message: string }) {
  return (
    <div className="repo-empty">
      <strong>Not available</strong>
      <p>{message}</p>
    </div>
  );
}
