"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { findingLabel } from "@/lib/findings";
import type { Finding } from "@/lib/api/types";

type Props = {
  finding: Finding;
  initialReason: string;
  onClose: () => void;
  onSave: (reason: string) => void;
};

const MIN_REASON_LENGTH = 12;

export function FalsePositiveModal({ finding, initialReason, onClose, onSave }: Props) {
  const [reason, setReason] = useState(initialReason);

  useEscapeKey(onClose);
  const trapRef = useFocusTrap<HTMLFormElement>();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) return; // o textarea também valida (required/minLength)
    onSave(trimmed);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form ref={trapRef} className="modal-card false-positive-modal" role="dialog" aria-modal="true" aria-labelledby="false-positive-title" onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        <span className="modal-icon"><Icon name="warning" size={23} /></span>
        <span className="section-kicker">FINDING TRIAGE</span>
        <h2 id="false-positive-title">Mark as False Positive</h2>
        <p className="false-positive-finding-name">{findingLabel(finding)}</p>
        <label htmlFor="false-positive-reason">TECHNICAL JUSTIFICATION</label>
        <textarea
          id="false-positive-reason"
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why this finding is not exploitable or does not apply..."
          minLength={MIN_REASON_LENGTH}
          required
          aria-describedby="false-positive-hint"
        />
        <p id="false-positive-hint" className="false-positive-hint">Minimum {MIN_REASON_LENGTH} characters ({reason.trim().length} written)</p>
        <div className="associate-actions">
          <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary">Save justification <Icon name="check" size={16} /></button>
        </div>
      </form>
    </div>
  );
}
