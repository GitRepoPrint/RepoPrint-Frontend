"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { useEscapeKey } from "@/hooks/use-escape-key";

const ERRORS: Record<number, string> = {
  401: "Your session expired. Sign in again to delete your account.",
  503: "Your data was removed, but the login account was not. Try again.",
};

const FOCUSABLE= "button:not(:disabled)";

export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [submitting, setSubmitting]= useState(false);
  const [error, setError]= useState<string>();
  const card= useRef<HTMLDivElement>(null);

  const close= useCallback(() => {
    if (!submitting) onClose();
  }, [submitting, onClose]);

  useEscapeKey(close);

  function trapFocus(event: KeyboardEvent) {
    if (event.key !== "Tab" || !card.current) return;
    const items= Array.from(card.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first= items[0];
    const last= items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function confirmDeletion() {
    setSubmitting(true);
    setError(undefined);
    try {
      const response= await fetch("/api/backend/me", { method: "DELETE" });
      if (!response.ok) {
        setError(ERRORS[response.status] ?? "The account could not be deleted. Try again.");
        setSubmitting(false);
        return;
      }
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch {
      setError("The account could not be deleted. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        ref={card}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <button type="button" className="modal-close" onClick={close} disabled={submitting} aria-label="Close"><Icon name="close" size={20} /></button>
        <span className="modal-icon"><Icon name="warning" size={23} /></span>
        <h2 id="delete-account-title">Delete your account</h2>
        <p id="delete-account-description">
          This permanently deletes your RepoPrint login, your repositories, analyses and false-positive feedback. Download your data first if you want a copy. This cannot be undone.
        </p>
        {error && <p role="alert" className="modal-error">{error}</p>}
        <div className="associate-actions">
          <button type="button" className="button button-outline" onClick={close} disabled={submitting} autoFocus>Cancel</button>
          <button type="button" className="button button-danger" onClick={confirmDeletion} disabled={submitting}>
            {submitting ? "Deleting account" : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}
