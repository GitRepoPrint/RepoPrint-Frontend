"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AssociateModal } from "@/components/repositories/associate-modal";
import { RepositoryHealth } from "@/components/repositories/repository-health";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useRepositories } from "@/hooks/use-repositories";
import { analyzeRepository } from "@/lib/api/analyze";
import { errorMessage } from "@/lib/api/errors";
import { ANALYZED_DESCRIPTION, PENDING_DESCRIPTION, newRepository, parseGithubRepository, repoSlug, stageOf, timeAgo } from "@/lib/api/repositories";
import type { Repository } from "@/lib/api/types";

/** O que a coluna da pontuação diz: a pontuação, "ainda sem pontuação" (analisado) ou o convite para analisar. */
function ScoreCell({ item, busy }: { item: Repository; busy: boolean }) {
  const stage = stageOf(item);
  if (stage === "scored") {
    const score = item.score as number;
    return (
      <>
        <span className={`score-indicator ${score >= HEALTHY_SCORE ? "healthy" : "attention"}`}>
          <Icon name={score >= HEALTHY_SCORE ? "shield" : "warning"} size={14} /> {score}/100
        </span>
        <span className="mini-progress"><i style={{ width: `${score}%` }} /></span>
      </>
    );
  }
  if (stage === "analyzed") {
    return <span className="pending-score" title="The threat analysis that produces the score is not available yet.">Not scored yet</span>;
  }
  return busy ? (
    <span className="analyze-action"><span className="analysis-spinner" aria-hidden="true" /> Analyzing…</span>
  ) : (
    <span className="analyze-action">Analyze now <Icon name="arrowRight" size={13} /></span>
  );
}

export function RepositoryRow({ item, busy = false, onOpen }: { item: Repository; busy?: boolean; onOpen: (item: Repository) => void }) {
  const stage = stageOf(item);
import { errorMessage } from "@/lib/api/errors";
import { associateRepository, formatAdded, parseGithubRepository, repoSlug } from "@/lib/api/repositories";
import type { SavedRepository } from "@/lib/api/types";

function RepositoryRow({ item, onOpen }: { item: SavedRepository; onOpen: (item: SavedRepository) => void }) {
  return (
    <button type="button" className="repository-row" onClick={() => onOpen(item)} disabled={busy} aria-busy={busy}>
      <span className="repo-identity">
        <span className="repo-icon"><Icon name={item.isPrivate ? "lock" : "github"} size={19} /></span>
        <span><strong>{item.name}</strong></span>
      </span>
      <span className="repo-score"><span className="pending-score">Pending analysis</span></span>
      <span className="repo-updated"><Icon name="clock" size={14} /> Added {formatAdded(item.addedAt)}</span>
      <Icon name="arrowRight" size={17} className="row-arrow" />
    </button>
  );
}

export function RepositoriesView() {
  const router = useRouter();
  const { notify } = useToast();
  const { repositories, add, update } = useRepositories();
  const [search, setSearch] = useState("");
  const [analyzing, setAnalyzing] = useState<ReadonlySet<string>>(() => new Set());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);
const GITHUB_MESSAGES: Record<string, string> = {
  connected: "GitHub connected. You can now add your private repositories.",
  denied: "GitHub access was not granted. Your account is not connected.",
  taken: "That GitHub account is already connected to another RepoPrint account.",
  unavailable: "The GitHub connection is not set up on this server yet.",
  error: "Could not connect GitHub. Please try again.",
};

function StatePanel({ title, message, role, children }: { title: string; message: string; role?: "status" | "alert"; children?: ReactNode }) {
  return (
    <div className="repo-empty" role={role}>
      <strong>{title}</strong>
      <p>{message}</p>
      {children}
    </div>
  );
}

export function RepositoriesView({ githubStatus }: { githubStatus?: string }) {
  const router= useRouter();
  const { notify }= useToast();
  const { state, add, retry }= useRepositories();
  const [search, setSearch]= useState("");
  const [modalOpen, setModalOpen]= useState(false);
  const closeModal= useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    const message= githubStatus ? GITHUB_MESSAGES[githubStatus] : undefined;
    if (!message) return;
    notify(message);
    window.history.replaceState(null, "", "/repositories");
  }, [githubStatus, notify]);

  const repositories= state.status === "ready" ? state.repositories : [];
  const query= search.toLowerCase();
  const filtered= repositories.filter((r) => r.name.toLowerCase().includes(query));

  const markAnalyzing = (name: string, on: boolean) =>
    setAnalyzing((current) => {
      const next = new Set(current);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });

  async function open(item: Repository) {
    const base = `/repositories/${repoSlug(item.name)}`;
    if (stageOf(item) !== "pending") { router.push(base); return; }
    if (analyzing.has(item.name)) return;

    // Um repositório acabado de associar ainda não tem diagrama: abrir é analisá-lo e depois ver o resultado.
    markAnalyzing(item.name, true);
    try {
      const result = await analyzeRepository(item.name);
      update(item.name, { analyzedAt: result.analyzedAt, ...(item.description === PENDING_DESCRIPTION ? { description: ANALYZED_DESCRIPTION } : {}) });
      if (!alive.current) return;
      notify(result.partial ? `${item.name} analyzed. Some files could not be read, so the diagram may be incomplete.` : `${item.name} analyzed.`);
      router.push(`${base}?tab=dfd`);
    } catch (error) {
      console.error("Repository analysis failed", error);
      if (alive.current) notify(errorMessage(error, "The analysis failed. Please try again."));
    } finally {
      if (alive.current) markAnalyzing(item.name, false);
    }
  function open(item: SavedRepository) {
    router.push(`/repositories/${repoSlug(item.name)}`);
  }

  async function associate(url: string): Promise<boolean> {
    const name= parseGithubRepository(url);
    if (!name) { notify("Enter a valid GitHub repository URL."); return false; }
    try {
      const saved= await associateRepository(name);
      add(saved);
      notify(`${saved.name} added to your repositories.`);
      return true;
    } catch (error) {
      notify(errorMessage(error, "Could not add the repository. Please try again."));
      return false;
    }
    add(newRepository(name));
    notify(`${name} added. Open it to analyze it.`);
    return true;
  }

  return (
    <>
      <main className="repositories-main" aria-busy={state.status === "loading"}>
        <div className="repositories-intro">
          <div><h1>Your repositories</h1></div>
          <button type="button" className="button button-primary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={17} /> Associate repository
          </button>
        </div>

        {state.status === "loading" && (
          <div className="repository-list">
            <StatePanel title="Loading your repositories" message="This takes a moment." role="status" />
          </div>
        )}

        {state.status === "failed" && (
          <div className="repository-list">
            <StatePanel title="Your repositories did not load" message={state.message} role="alert">
              <button type="button" className="button button-primary" onClick={retry}>Try again</button>
            </StatePanel>
          </div>
        )}

        <div className="repository-list">
          <div className="repository-list-columns"><span>REPOSITORY</span><span>SECURITY SCORE</span><span>LAST ANALYSIS</span><span /></div>
          {filtered.length
            ? filtered.map((item) => <RepositoryRow key={item.name} item={item} busy={analyzing.has(item.name)} onOpen={open} />)
            : <div className="repo-empty">No repositories match your search.</div>}
          <div className="repository-bottom">
            <span>Showing {filtered.length} of {repositories.length} {repositories.length === 1 ? "repository" : "repositories"}</span>
            <button type="button" onClick={() => setModalOpen(true)}>Add another repository <Icon name="plus" size={14} /></button>
        {state.status === "ready" && repositories.length === 0 && (
          <div className="repository-list">
            <StatePanel title="No repositories yet" message="Associate a GitHub repository to open its dashboard. Private ones need your GitHub account connected from the profile menu.">
              <button type="button" className="button button-primary" onClick={() => setModalOpen(true)}>
                <Icon name="plus" size={17} /> Associate repository
              </button>
            </StatePanel>
          </div>
        )}

        {state.status === "ready" && repositories.length > 0 && (
          <>
            <RepositoryHealth repositories={repositories.map(({ name }) => ({ name, score: null }))} />

            <div className="repository-list-heading">
              <div><h2>Repository overview <span>{repositories.length}</span></h2></div>
              <label className="repository-search">
                <Icon name="search" size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repositories..." aria-label="Search repositories" />
              </label>
            </div>

            <div className="repository-list">
              <div className="repository-list-columns"><span>REPOSITORY</span><span>SECURITY SCORE</span><span>ADDED</span><span /></div>
              {filtered.length
                ? filtered.map((item) => <RepositoryRow key={item.id} item={item} onOpen={open} />)
                : <div className="repo-empty">No repositories match your search.</div>}
              <div className="repository-bottom">
                <span>Showing {filtered.length} of {repositories.length} {repositories.length === 1 ? "repository" : "repositories"}</span>
                <button type="button" onClick={() => setModalOpen(true)}>Add another repository <Icon name="plus" size={14} /></button>
              </div>
            </div>
          </>
        )}
      </main>

      {modalOpen && <AssociateModal onClose={closeModal} onAssociate={associate} />}
    </>
  );
}
