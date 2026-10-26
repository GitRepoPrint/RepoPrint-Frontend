"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AssociateModal } from "@/components/repositories/associate-modal";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useRepositories } from "@/hooks/use-repositories";
import { newRepository, parseRepositoryUrl, repoSlug } from "@/lib/api/repositories";
import type { Repository } from "@/lib/api/types";

const HEALTHY_SCORE = 80;
const pad = (n: number) => String(n).padStart(2, "0");

function RepositoryRow({ item, onOpen }: { item: Repository; onOpen: (item: Repository) => void }) {
  return (
    <button type="button" className="repository-row" onClick={() => onOpen(item)}>
      <span className="repo-identity">
        <span className="repo-icon"><Icon name="github" size={19} /></span>
        <span><strong>{item.name}</strong><small>{item.description}</small></span>
      </span>
      <span className="repo-score">
        {item.score === null ? (
          <span className="pending-score">Pending analysis</span>
        ) : (
          <>
            <span className={`score-indicator ${item.score >= HEALTHY_SCORE ? "healthy" : "attention"}`}>
              <Icon name={item.score >= HEALTHY_SCORE ? "shield" : "warning"} size={14} /> {item.score}/100
            </span>
            <span className="mini-progress"><i style={{ width: `${item.score}%` }} /></span>
          </>
        )}
      </span>
      <span className="repo-updated"><Icon name="clock" size={14} /> {item.updated}</span>
      <Icon name="arrowRight" size={17} className="row-arrow" />
    </button>
  );
}

export function RepositoriesView() {
  const router = useRouter();
  const { notify } = useToast();
  const { repositories, add } = useRepositories();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // Enquanto a lista não é lida no cliente, não se mostram números que depois mudariam.
  if (!repositories) return <main className="repositories-main" aria-busy="true" />;

  const healthy = repositories.filter((r) => r.score !== null && r.score >= HEALTHY_SCORE).length;
  const attention = repositories.filter((r) => r.score !== null && r.score < HEALTHY_SCORE).length;
  const query = search.toLowerCase();
  const filtered = repositories.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(query));

  function open(item: Repository) {
    if (item.score === null) { notify("Analysis is pending for this repository."); return; }
    router.push(`/repositories/${repoSlug(item.name)}`);
  }

  function associate(url: string): boolean {
    const name = parseRepositoryUrl(url);
    if (!name) { notify("Enter a valid GitHub repository URL."); return false; }
    if (repositories!.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      notify("This repository is already associated.");
      return false;
    }
    add(newRepository(name));
    notify(`${name} added to your repositories.`);
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

        <div className="repository-stats">
          <div>
            <span className="stat-icon violet"><Icon name="layers" size={19} /></span>
            <span>ASSOCIATED REPOSITORIES</span><strong>{pad(repositories.length)}</strong><small>Projects in your workspace</small>
          </div>
          <div>
            <span className="stat-icon green-icon"><Icon name="shield" size={19} /></span>
            <span>HEALTHY PROJECTS</span><strong>{pad(healthy)}</strong><small>Security score of {HEALTHY_SCORE} or higher</small>
          </div>
          <div>
            <span className="stat-icon orange-icon"><Icon name="warning" size={19} /></span>
            <span>NEEDS ATTENTION</span><strong>{pad(attention)}</strong><small>Opportunity to improve</small>
          </div>
        </div>

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
            ? filtered.map((item) => <RepositoryRow key={item.name} item={item} onOpen={open} />)
            : <div className="repo-empty">No repositories match your search.</div>}
        </div>

        <div className="repository-bottom">
          <button type="button" onClick={() => setModalOpen(true)}>Add another repository <Icon name="plus" size={14} /></button>
        </div>
      </main>

      {modalOpen && <AssociateModal onClose={closeModal} onAssociate={associate} />}
    </>
  );
}
