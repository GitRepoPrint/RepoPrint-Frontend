"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssociateModal } from "@/components/repositories/associate-modal";
import { HEALTHY_SCORE, RepositoryHealth } from "@/components/repositories/repository-health";
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
  return (
    <button type="button" className="repository-row" onClick={() => onOpen(item)} disabled={busy} aria-busy={busy}>
      <span className="repo-identity">
        <span className="repo-icon"><Icon name="github" size={19} /></span>
        <span><strong>{item.name}</strong><small>{item.description}</small></span>
      </span>
      <span className="repo-score"><ScoreCell item={item} busy={busy} /></span>
      <span className="repo-updated"><Icon name="clock" size={14} /> {stage === "analyzed" ? timeAgo(item.analyzedAt as string) : item.updated}</span>
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

  // Enquanto a lista não é lida no cliente, não se mostram números que depois mudariam.
  if (!repositories) return <main className="repositories-main" aria-busy="true" />;

  const query = search.toLowerCase();
  const filtered = repositories.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(query));

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
  }

  function associate(url: string): boolean {
    const name = parseGithubRepository(url);
    if (!name) { notify("Enter a valid GitHub repository URL."); return false; }
    if (repositories!.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      notify("This repository is already associated.");
      return false;
    }
    add(newRepository(name));
    notify(`${name} added. Open it to analyze it.`);
    return true;
  }

  return (
    <>
      <main className="repositories-main">
        <div className="repositories-intro">
          <div><h1>Your repositories<span>.</span></h1></div>
          <button type="button" className="button button-primary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={17} /> Associate repository
          </button>
        </div>

        <RepositoryHealth repositories={repositories} />

        <div className="repository-list-heading">
          <div><h2>Repository overview <span>{repositories.length}</span></h2></div>
          <label className="repository-search">
            <Icon name="search" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repositories..." aria-label="Search repositories" />
          </label>
        </div>

        <div className="repository-list">
          <div className="repository-list-columns"><span>REPOSITORY</span><span>SECURITY SCORE</span><span>LAST ANALYSIS</span><span /></div>
          {filtered.length
            ? filtered.map((item) => <RepositoryRow key={item.name} item={item} busy={analyzing.has(item.name)} onOpen={open} />)
            : <div className="repo-empty">No repositories match your search.</div>}
          <div className="repository-bottom">
            <span>Showing {filtered.length} of {repositories.length} {repositories.length === 1 ? "repository" : "repositories"}</span>
            <button type="button" onClick={() => setModalOpen(true)}>Add another repository <Icon name="plus" size={14} /></button>
          </div>
        </div>
      </main>

      {modalOpen && <AssociateModal onClose={closeModal} onAssociate={associate} />}
    </>
  );
}
