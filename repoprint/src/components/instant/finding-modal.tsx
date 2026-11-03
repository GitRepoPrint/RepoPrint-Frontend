"use client";

import { effortText } from "@/components/score/effort";
import { Icon } from "@/components/ui/icon";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { SEVERITY_LABEL } from "@/lib/findings";
import type { Finding } from "@/lib/api/types";

type Props = { finding: Finding; onClose: () => void };

export function FindingModal({ finding: f, onClose }: Props) {
  useEscapeKey(onClose);
  const trapRef = useFocusTrap<HTMLDivElement>();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={trapRef} className="modal-card finding-modal" role="dialog" aria-modal="true" aria-labelledby="finding-modal-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        <span className="section-kicker">{f.framework} · {f.category.toUpperCase()} · {f.ref}</span>
        <h2 id="finding-modal-title">{f.title}</h2>
        <span className={`finding-severity-badge ${f.severity}`}>{SEVERITY_LABEL[f.severity]} severity</span>
        <p className="finding-modal-summary">{f.impactDetail}</p>

        <dl className="finding-modal-grid">
          <div><dt>COMPONENT</dt><dd>{f.component}</dd></div>
          <div><dt>FILE</dt><dd><code>{f.file}</code></dd></div>
          <div><dt>LOCATION</dt><dd>{f.location}</dd></div>
          <div><dt>IMPACT</dt><dd>{f.exposure.impactLabel} · {SEVERITY_LABEL[f.exposure.impact]}</dd></div>
          <div><dt>FIX EFFORT</dt><dd>{effortText(f.effort)}</dd></div>
        </dl>

        <span className="finding-modal-title">REGULATORY REFERENCES</span>
        <div className="finding-regulatory-tags">
          {f.regulatoryTags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>

        <div className="associate-actions">
          <button type="button" className="button button-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
