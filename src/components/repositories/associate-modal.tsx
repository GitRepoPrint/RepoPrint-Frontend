"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { useEscapeKey } from "@/hooks/use-escape-key";

type AssociateModalProps = {
  onClose: () => void;
  /** Devolve true se o repositório foi associado (o modal fecha); false mantém-no aberto. */
  onAssociate: (url: string) => Promise<boolean>;
};

export function AssociateModal({ onClose, onAssociate }: AssociateModalProps) {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);

  useEscapeKey(onClose);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    const associated = await onAssociate(url);
    setChecking(false);
    if (associated) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card associate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="associate-title"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        <span className="modal-icon"><Icon name="plus" size={23} /></span>
        <span className="section-kicker">EXPAND YOUR WORKSPACE</span>
        <h2 id="associate-title">Associate a repository.</h2>
        <p>Add a GitHub repository to keep it alongside your other projects. To add a private one, connect GitHub from the profile menu first.</p>
        <label htmlFor="new-repo-url">REPOSITORY URL</label>
        <div className="associate-input">
          <Icon name="github" size={19} />
          <input id="new-repo-url" autoFocus value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/org/repo" />
        </div>
        <div className="associate-actions">
          <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={checking}>{checking ? "Checking access" : "Associate repository"} <Icon name="arrowRight" size={16} /></button>
        </div>
      </form>
    </div>
  );
}
