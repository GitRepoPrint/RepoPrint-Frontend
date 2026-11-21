"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AssociateModal } from "@/components/repositories/associate-modal";
import { RepositoryHealth } from "@/components/repositories/repository-health";
import { Icon } from "@/components/ui/icon";
import { RepositoriesBodySkeleton } from "@/components/skeletons/page-skeletons";
import { useToast } from "@/components/ui/toast";
import { useRepositories } from "@/hooks/use-repositories";
import { errorMessage } from "@/lib/api/errors";
import { associateRepository, formatAdded, parseGithubRepository, repoSlug } from "@/lib/api/repositories";
import type { SavedRepository } from "@/lib/api/types";

function RepositoryRow({ item, onOpen }: { item: SavedRepository; onOpen: (item: SavedRepository) => void }) {
  return (
    <button type="button" className="repository-row" onClick={() => onOpen(item)}>
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

const GITHUB_MESSAGES: Record<string, string> = {
  connected: "GitHub connected. You can now add your private repositories.",
  denied: "GitHub access was not granted. Your account is not connected.",
  taken: "That GitHub account is already connected to another RepoPrint account.",
  unavailable: "The GitHub connection is not set up on this server yet.",
  error: "Could not connect GitHub. Please try again.",
};

const GITHUB_APP_MESSAGES: Record<string, string> = {
  installed: "RepoPrint app installed. Code analysis can now read the private repositories it covers.",
  denied: "The RepoPrint app was not installed.",
  requested: "Installation requested. An owner of the organization has to approve it.",
  forbidden: "That installation does not belong to your GitHub account.",
  unavailable: "The RepoPrint app is not set up on this server yet.",
  error: "Could not install the RepoPrint app. Please try again.",
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

export function RepositoriesView({ githubStatus, githubAppStatus }: { githubStatus?: string; githubAppStatus?: string }) {
  const router= useRouter();
  const { notify }= useToast();
  const { state, add, retry }= useRepositories();
  const [search, setSearch]= useState("");
  const [modalOpen, setModalOpen]= useState(false);
  const closeModal= useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    const message= (githubStatus ? GITHUB_MESSAGES[githubStatus] : undefined) ?? (githubAppStatus ? GITHUB_APP_MESSAGES[githubAppStatus] : undefined);
    if (!message) return;
    notify(message);
    window.history.replaceState(null, "", "/repositories");
  }, [githubStatus, githubAppStatus, notify]);

  const repositories= state.status === "ready" ? state.repositories : [];
  const query= search.toLowerCase();
  const filtered= repositories.filter((r) => r.name.toLowerCase().includes(query));

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
          <>
            <span className="sr-only" role="status">Loading your repositories</span>
            <RepositoriesBodySkeleton />
          </>
        )}

        {state.status === "failed" && (
          <div className="repository-list">
            <StatePanel title="Your repositories did not load" message={state.message} role="alert">
              <button type="button" className="button button-primary" onClick={retry}>Try again</button>
            </StatePanel>
          </div>
        )}

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
