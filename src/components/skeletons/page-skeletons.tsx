"use client";

// O desenho de cada página enquanto o servidor a prepara (os ficheiros loading.tsx).
//
// Para não saltar nada quando a página chega, cada esqueleto usa o MESMO código e as MESMAS classes da página a sério: o que é fixo
// (títulos, separadores, botões, legendas) é o texto verdadeiro, e só o que depende de dados (nomes, números, listas, o diagrama) é um
// bloco que cintila. A Toolbox, o Inspector e a barra do diagrama são os próprios componentes. Quem muda uma página muda aqui também:
// skeletons.test.tsx confere que os textos fixos continuam iguais aos da página.
import { useParams, useSearchParams } from "next/navigation";
import { Inspector } from "@/components/canvas/inspector";
import { Toolbox } from "@/components/canvas/toolbox";
import { FocusBar } from "@/components/dfd/focus-bar";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { DfdFocus } from "@/hooks/use-dfd-focus";
import { ALL_KINDS } from "@/lib/dfd/focus";
import { repoFromSlug } from "@/lib/api/repositories";

const noop = () => {};

function Announce({ children }: { children: string }) {
  return <span className="sr-only" role="status">{children}</span>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Repositórios (components/repositories/repositories-view.tsx e repository-health.tsx)

/** Tudo o que fica por baixo do título: o cartão de saúde, o cabeçalho da lista e a lista. */
export function RepositoriesBodySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="sk-mask" aria-hidden="true">
      <section className="repository-health">
        <div className="repository-health-stats">
          <div>
            <span className="stat-icon green-icon"><Icon name="shield" size={19} /></span>
            <span className="stat-label">HEALTHY PROJECTS</span>
            <strong><Skeleton inline width={60} height={38} /></strong>
            <small>Security score of 80 or higher</small>
          </div>
          <div>
            <span className="stat-icon orange-icon"><Icon name="warning" size={19} /></span>
            <span className="stat-label">NEEDS ATTENTION</span>
            <strong><Skeleton inline width={60} height={38} /></strong>
            <small>Opportunity to improve</small>
          </div>
        </div>
        <div className="lupa-wrap"><Skeleton circle width={200} height={200} /></div>
        <ul className="lupa-legend">
          {[70, 110, 120].map((width) => <li key={width}><Skeleton inline width={width} height={14} /></li>)}
        </ul>
      </section>

      <div className="repository-list-heading">
        <div><h2><span>Repository overview</span> <span className="sk-count"><Skeleton inline width={12} height={14} /></span></h2></div>
        <label className="repository-search">
          <Icon name="search" size={17} />
          <input disabled tabIndex={-1} placeholder="Search repositories..." aria-label="Search repositories" />
        </label>
      </div>

      <div className="repository-list">
        <div className="repository-list-columns"><span>REPOSITORY</span><span>SECURITY SCORE</span><span>ADDED</span><span /></div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="repository-row">
            <span className="repo-identity">
              <span className="repo-icon"><Icon name="github" size={19} /></span>
              <span><Skeleton inline width={170} height={16} /></span>
            </span>
            <span className="repo-score"><Skeleton inline width={110} height={14} /></span>
            <span className="repo-updated"><Icon name="clock" size={14} /> <Skeleton inline width={90} height={14} /></span>
            <Icon name="arrowRight" size={17} className="row-arrow" />
          </div>
        ))}
        <div className="repository-bottom">
          <span><Skeleton inline width={150} height={14} /></span>
          <button type="button" disabled tabIndex={-1}>Add another repository <Icon name="plus" size={14} /></button>
        </div>
      </div>
    </div>
  );
}

export function RepositoriesSkeleton() {
  return (
    <main className="repositories-main sk-mask" aria-busy="true">
      <Announce>Loading your repositories</Announce>
      <div className="repositories-intro" aria-hidden="true">
        <div><h1>Your repositories</h1></div>
        <button type="button" className="button button-primary" disabled tabIndex={-1}>
          <Icon name="plus" size={17} /> Associate repository
        </button>
      </div>
      <RepositoriesBodySkeleton />
    </main>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Dashboard de um repositório (components/dashboard/*)

const TABS = [
  { id: "threats", label: "Threat Modeling & Architectural Posture" },
  { id: "dfd", label: "Inferred Architecture & Data Flow Diagram" },
  { id: "team", label: "Team Dynamics & Repository Hygiene" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const chip = (width: number) => <Skeleton inline width={width} height={24} className="skeleton-chip" />;

function TeamSkeleton() {
  return (
    <section className="dashboard-section team-page">
      <section className="team-box">
        <header className="team-box-header">
          <div>
            <h3>Team activity</h3>
            <p>Commits, pull request reviews and code ownership in the last 30 days.</p>
          </div>
          {chip(130)}
        </header>
        <div className="team-stats">
          {["Average commits per week", "Median PR merge time", "Code Owners coverage"].map((label) => (
            <div key={label} className="team-stat">
              <span className="team-stat-label">{label}</span>
              <strong><Skeleton inline width={56} height={30} /></strong>
              {chip(120)}
            </div>
          ))}
        </div>
        <div className="team-table-wrap">
          <table className="team-table">
            <thead>
              <tr><th scope="col">Contributor</th><th scope="col">Commits</th><th scope="col">Review participation</th><th scope="col">Code ownership</th></tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i}>
                  <td><div className="team-person"><Skeleton circle width={40} height={40} /><div><Skeleton width={110} height={16} /></div></div></td>
                  <td><Skeleton inline width={30} height={14} /></td>
                  <td><Skeleton inline width={150} height={10} /></td>
                  <td><Skeleton inline width={90} height={14} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="team-table-note"><Skeleton inline width="70%" height={12} /></p>
      </section>

      <section className="team-box">
        <header className="team-box-header">
          <div>
            <h3>Repository hygiene</h3>
            <p>Branch rules, tests and license found through the GitHub API.</p>
          </div>
        </header>
        <div className="hygiene-overview">
          <section className="hygiene-chart">
            <header className="hygiene-chart-header">
              <h4>Git activity</h4>
              <div className="chart-tabs">
                {["Commits per week", "PR merge time", "Activity by day and hour"].map((label, i) => (
                  <span key={label} className={i === 0 ? "chart-tab active" : "chart-tab"}>{label}</span>
                ))}
              </div>
            </header>
            <figure className="chart-figure">
              <div className="chart-plot"><Skeleton height="100%" /></div>
              <div className="chart-axis"><Skeleton inline width={80} height={12} /><Skeleton inline width={60} height={12} /></div>
              <figcaption className="chart-legend"><Skeleton inline width={160} height={12} /></figcaption>
            </figure>
            <p className="chart-summary"><Skeleton inline width="80%" height={14} /></p>
          </section>
          <div className="hygiene-grade">
            <strong><Skeleton inline width={90} height={56} /></strong>
            <span>/ 100</span>
            <small>Git hygiene grade</small>
          </div>
        </div>
        <div className="hygiene-checks">
          <article className="hygiene-check tall">
            <header className="hygiene-check-header"><h4>Branch protection</h4>{chip(90)}</header>
            <dl className="branch-info">
              {["Default branch", "Rules", "Also protected", "Not protected"].map((label) => (
                <div key={label}><dt>{label}</dt><dd><Skeleton inline width={120} height={14} /></dd></div>
              ))}
            </dl>
          </article>
          <article className="hygiene-check">
            <header className="hygiene-check-header"><h4>Tests and CI</h4>{chip(80)}</header>
            <p className="hygiene-check-value"><Skeleton inline width={190} height={16} /></p>
          </article>
          <article className="hygiene-check">
            <header className="hygiene-check-header"><h4>License</h4>{chip(100)}</header>
            <p className="hygiene-check-value"><Skeleton inline width={240} height={16} /></p>
          </article>
        </div>
      </section>
    </section>
  );
}

function DfdTabSkeleton() {
  return (
    <div className="dfd-tab">
      <div className="dfd-tab-header">
        <button type="button" className="button dfd-edit-button" disabled tabIndex={-1}><Icon name="external" size={16} /> Edit DFD in Full Canvas</button>
      </div>
      <p className="dfd-notice">
        <Icon name="info" size={16} />
        {/* a nota a sério tem duas linhas */}
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <Skeleton height={14} />
          <Skeleton width="45%" height={14} />
        </span>
      </p>
      <section className="dfd-preview-section">
        <div className="dfd-layout">
          <div className="dfd-preview">
            <div className="dfd-preview-viewport dfd-preview-viewport-autofit" style={{ display: "grid", placeItems: "center" }}>
              <div className="sk-row" style={{ gap: 56 }}>
                <Skeleton width={130} height={54} />
                <Skeleton circle width={90} height={90} />
                <Skeleton width={150} height={72} />
              </div>
            </div>
            <div className="dfd-preview-footer">
              <ul className="dfd-risk-key">
                <li><i className="risk-high" />High</li>
                <li><i className="risk-medium" />Medium</li>
                <li><i className="risk-low" />Low</li>
                <li><i className="risk-none" />No findings</li>
                <li>Number shows the findings on each component</li>
              </ul>
              <span className="dfd-live-sync"><span />Fits the box</span>
            </div>
          </div>
          <aside className="dfd-node-panel">
            <div className="dfd-node-panel-head">
              <span className="dfd-node-panel-kicker">Selected component</span>
              <h3><Skeleton inline width={160} height={24} /></h3>
              <p className="dfd-node-panel-meta"><Skeleton inline width={200} height={14} /></p>
              <p className="dfd-node-panel-meta"><Skeleton inline width={130} height={14} /></p>
            </div>
            <div>
              <span className="dfd-node-panel-kicker">Where this comes from</span>
              <Skeleton height={44} />
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function OtherTabSkeleton() {
  return (
    <section className="dashboard-section team-page">
      <section className="team-box">
        <header className="team-box-header">
          <div>
            <h3><Skeleton inline width={180} height={22} /></h3>
            <p><Skeleton inline width={420} height={14} /></p>
          </div>
        </header>
      </section>
    </section>
  );
}

export function DashboardSkeleton() {
  const { repoId } = useParams<{ repoId: string }>();
  const requested = useSearchParams().get("tab");
  const name = repoFromSlug(String(repoId ?? ""));
  // Os repositórios reais abrem no separador da equipa (dashboard-view.tsx); o ?tab= manda
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "team";

  return (
    <main className="dashboard-main sk-mask" aria-busy="true">
      <Announce>{name ? `Loading ${name}` : "Loading the repository"}</Announce>
      <div className="dashboard-heading">
        <div className="dashboard-heading-primary">
          <h1 className="dashboard-repository-title">
            <button type="button" className="dashboard-back-button" aria-label="Back to repositories" title="Back to repositories" disabled tabIndex={-1}>
              <Icon name="arrow" size={18} />
            </button>
            <Icon name="github" size={25} /> <span>{name ?? <Skeleton inline width={220} height={28} />}</span>
          </h1>
          <div className="dashboard-heading-actions">
            <div className="dashboard-action-buttons">
              <div className="scan-action">
                <button type="button" className="button button-primary scan-now" disabled tabIndex={-1}><Icon name="spark" size={16} /> Scan Now</button>
                <span className="scan-time"><Skeleton inline width={120} height={12} /></span>
              </div>
              <button type="button" className="button button-outline export-report" disabled tabIndex={-1}>
                <Icon name="download" size={17} /> Export PDF Report
              </button>
            </div>
          </div>
        </div>
        <div className="dashboard-controls">
          <div className="dropdown-wrap">
            <span className="branch-button"><Icon name="branch" size={14} /> <Skeleton inline width={44} height={14} /> <Icon name="chevron" size={13} /></span>
          </div>
          <div className="analysis-history-controls">
            <label>
              <span>Analysis history</span>
              <select aria-label="Recent analysis history" disabled tabIndex={-1}><option>Not available</option></select>
            </label>
          </div>
        </div>
      </div>

      <nav className="dashboard-tabs" aria-label="Dashboard analysis sections">
        {TABS.map(({ id, label }) => (
          <span key={id} className={`dashboard-tab ${tab === id ? "active" : ""}`}><span>{label}</span></span>
        ))}
      </nav>

      <div className="dashboard-tab-content">
        <div className="dashboard-tab-panel" aria-hidden="true">
          {tab === "team" ? <TeamSkeleton /> : tab === "dfd" ? <DfdTabSkeleton /> : <OtherTabSkeleton />}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Vista completa do diagrama (components/canvas/*)

/** A barra do diagrama tal como está por omissão, para o esqueleto usar o próprio componente. */
const PLACEHOLDER_FOCUS: DfdFocus = {
  state: { mode: "main", picked: [], kinds: new Set(ALL_KINDS), query: "", sort: "importance", levels: 2, includeAuxiliary: false },
  result: { view: { nodes: [], edges: [], children: {} }, total: 0, shown: 0 },
  rows: [],
  touched: false,
  setMode: noop, togglePicked: noop, toggleKind: noop, setQuery: noop, setSort: noop, setLevels: noop, setIncludeAuxiliary: noop, reset: noop,
};

export function CanvasSkeleton() {
  const { repoId } = useParams<{ repoId: string }>();
  const branch = useSearchParams().get("branch");
  const name = repoFromSlug(String(repoId ?? ""));

  return (
    <div className="canvas-app h-[calc(100vh-var(--nav-h))]! sk-mask" aria-busy="true">
      <Announce>Loading the diagram</Announce>
      <div className="canvas-toolbar canvas-main-toolbar" aria-hidden="true">
        <div className="canvas-toolbar-context">
          <span className="canvas-breadcrumb"><Icon name="arrow" size={15} /> Overview</span>
          <span className="crumb-slash">/</span>
          <span className="canvas-repo-name">{name ?? <Skeleton inline width={120} height={14} />}</span>
          <span className="canvas-branch">{branch ?? <Skeleton inline width={36} height={12} />}</span>
          <span className="toolbar-divider" />
          <span className="canvas-title-icon"><Icon name="flow" size={16} /></span>
          <strong>Data Flow Diagram</strong>
        </div>
        <div className="toolbar-right">
          <span className="saved-state"><Skeleton inline width={120} height={12} /></span>
          <span className="live-badge"><span className="status-dot green" /> LIVE CANVAS</span>
          <span className="toolbar-divider" />
          <button type="button" disabled tabIndex={-1} aria-label="Zoom out"><Icon name="minus" size={16} /></button>
          <span className="zoom-text"><Skeleton inline width={34} height={12} /></span>
          <button type="button" disabled tabIndex={-1} aria-label="Zoom in"><Icon name="plus" size={16} /></button>
          <button type="button" disabled tabIndex={-1} className="canvas-toolbar-command button button-outline inline-flex! flex-row!"><Icon name="grid" size={16} /> Auto Layout</button>
          <button type="button" disabled tabIndex={-1} className="canvas-toolbar-command button button-outline inline-flex! flex-row!"><Icon name="save" size={16} /> Save Diagram</button>
          <button type="button" disabled tabIndex={-1} className="canvas-toolbar-command button button-primary inline-flex! flex-row!"><Icon name="download" size={16} /> Export SVG</button>
        </div>
      </div>
      <div aria-hidden="true"><FocusBar focus={PLACEHOLDER_FOCUS} loading /></div>
      <div className="workspace" aria-hidden="true">
        <Toolbox onAdd={noop} onConnectorHint={noop} />
        <div className="diagram-canvas bg-none!">
          <div className="absolute inset-0" style={{ display: "grid", placeItems: "center" }}>
            <div className="sk-row" style={{ gap: 56 }}>
              <Skeleton width={130} height={54} />
              <Skeleton circle width={90} height={90} />
              <Skeleton width={150} height={72} />
            </div>
          </div>
          <div className="canvas-watermark pointer-events-none z-5">{name ?? "…"} <span>/</span> DFD v1.0</div>
        </div>
        <Inspector node={undefined} findings={[]} />
      </div>
    </div>
  );
}
