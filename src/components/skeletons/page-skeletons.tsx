import { Skeleton } from "@/components/ui/skeleton";

// O desenho de cada página enquanto o servidor a prepara (os ficheiros loading.tsx). Imitam a página a sério (cabeçalho, separadores,
// cartões, lista) para que, quando ela chega, nada salte. Não mostram progresso: não se sabe quanto falta.

function Announce({ children }: { children: string }) {
  return <span className="sr-only" role="status">{children}</span>;
}

export function RepositoriesSkeleton() {
  return (
    <main className="repositories-main" aria-busy="true">
      <Announce>Loading your repositories</Announce>
      <div className="sk-page">
        <div className="sk-row sk-between">
          <Skeleton width={320} height={40} />
          <Skeleton width={190} height={42} />
        </div>
        <div className="sk-card">
          <Skeleton width="30%" height={22} />
          <Skeleton width="55%" height={14} />
        </div>
        <RepositoryRowsSkeleton />
      </div>
    </main>
  );
}

/** Linhas de repositórios por chegar: a lista de repositórios usa-as também enquanto carrega. */
export function RepositoryRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="sk-card" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row sk-between">
          <div className="sk-row">
            <Skeleton circle width={38} height={38} />
            <Skeleton width={180} height={16} />
          </div>
          <Skeleton width={110} height={14} />
          <Skeleton width={120} height={14} />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="dashboard-main" aria-busy="true">
      <Announce>Loading the repository</Announce>
      <div className="sk-page">
        <div className="sk-row sk-between">
          <div className="sk-row">
            <Skeleton width={34} height={34} />
            <Skeleton width={260} height={30} />
          </div>
          <div className="sk-row">
            <Skeleton width={120} height={40} />
            <Skeleton width={160} height={40} />
          </div>
        </div>
        <div className="sk-row">
          <Skeleton width={120} height={32} />
          <Skeleton width={300} height={32} />
        </div>
        <div className="sk-row">
          <Skeleton width={240} height={22} />
          <Skeleton width={260} height={22} />
          <Skeleton width={260} height={22} />
        </div>
        <div className="sk-cards">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sk-card">
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={34} />
              <Skeleton width={90} height={22} />
            </div>
          ))}
        </div>
        <div className="sk-card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sk-row sk-between">
              <div className="sk-row">
                <Skeleton circle width={36} height={36} />
                <Skeleton width={150} height={16} />
              </div>
              <Skeleton width={70} height={14} />
              <Skeleton width={160} height={14} />
              <Skeleton width={110} height={14} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function CanvasSkeleton() {
  return (
    <div className="canvas-app h-[calc(100vh-72px)]!" aria-busy="true">
      <Announce>Loading the diagram</Announce>
      <div className="sk-row sk-between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-border, #323847)" }}>
        <div className="sk-row">
          <Skeleton width={90} height={20} />
          <Skeleton width={150} height={20} />
        </div>
        <div className="sk-row">
          <Skeleton width={90} height={32} />
          <Skeleton width={120} height={32} />
          <Skeleton width={110} height={32} />
        </div>
      </div>
      <div className="sk-canvas">
        <div className="sk-stack">
          <Skeleton width="60%" height={14} />
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={54} />)}
        </div>
        <div className="sk-stack" style={{ alignItems: "center", justifyContent: "center" }}>
          <div className="sk-row" style={{ gap: 48 }}>
            <Skeleton width={120} height={54} />
            <Skeleton circle width={86} height={86} />
            <Skeleton width={130} height={70} />
          </div>
        </div>
        <div className="sk-stack">
          <Skeleton width="50%" height={14} />
          <Skeleton height={64} />
          <Skeleton height={110} />
        </div>
      </div>
    </div>
  );
}
