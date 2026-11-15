import { Icon } from "@/components/ui/icon";

type GitDashboardHeaderProps = {
  repository: string;
  branch: string;
  dataTime: string;
  onBack: () => void;
  onExport: () => void;
};

export function GitDashboardHeader({ repository, branch, dataTime, onBack, onExport }: GitDashboardHeaderProps) {
  return (
    <div className="dashboard-heading">
      <div className="dashboard-heading-primary">
        <h1 className="dashboard-repository-title">
          <button type="button" className="dashboard-back-button" aria-label="Back to repositories" title="Back to repositories" onClick={onBack}>
            <Icon name="arrow" size={18} />
          </button>
          <Icon name="github" size={25} /> <span>{repository}</span>
        </h1>
        <div className="dashboard-heading-actions">
          <div className="dashboard-action-buttons">
            <div className="scan-action">
              <span className="scan-time">{dataTime}</span>
            </div>
            <button type="button" className="button button-outline export-report" onClick={onExport}>
              <Icon name="download" size={17} /> Export PDF Report
            </button>
          </div>
        </div>
      </div>
      <div className="dashboard-controls">
        <span className="branch-button">
          <Icon name="branch" size={14} /> <span className="sr-only">Default branch </span>{branch}
        </span>
      </div>
    </div>
  );
}
