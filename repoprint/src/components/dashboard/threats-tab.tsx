"use client";

import { useState } from "react";
import { KIND_LABEL } from "@/components/dfd/dfd-scene";
import { Icon } from "@/components/ui/icon";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { byFramework, countBySeverity, SEVERITY_LABEL } from "@/lib/findings";
import type { NodeRisk } from "@/lib/findings";
import type { Finding, RepositoryAnalysis, Severity } from "@/lib/api/types";

type ThreatsTabProps = {
  analysis: RepositoryAnalysis;
  risks: NodeRisk[];
  nodeId: string;
  reasons: Record<string, string>;                 // id do finding -> justificação de falso positivo
  onTriage: (finding: Finding) => void;
  onSelectNode: (id: string) => void;
  onShowInDiagram: (id: string) => void;
};

const PROBABILITY_MEANING: Record<Severity, string> = { high: "likely", medium: "possible", low: "unlikely" };

const RATING_ROWS: { level: Severity; impact: string; probability: string }[] = [
  { level: "high", impact: "Account takeover, or loss of payments or personal data.", probability: "Likely. All 3 signals are present." },
  { level: "medium", impact: "Limited data exposure or a degraded service.", probability: "Possible. 2 signals are present." },
  { level: "low", impact: "A minor information leak with no direct harm.", probability: "Unlikely. 1 signal or none." },
];

const TERMS = [
  { name: "STRIDE", text: "Security threat model: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege." },
  { name: "LINDDUN", text: "Privacy threat model: Linkability, Identifiability, Non-repudiation, Detectability, Disclosure of information, Unawareness, Non-compliance." },
  { name: "Trust boundary", text: "The line between components you control and those you do not. Data that crosses it can be forged or read." },
  { name: "Data flow diagram", text: "A map of external entities, processes, data stores and the data that moves between them." },
];

const PROBABILITY_SIGNALS = [
  { name: "Reach", text: "The component can be reached from outside the trust boundary in the diagram." },
  { name: "Activity", text: "The affected file changed often, or by many people, in the last 90 days." },
  { name: "Missing safeguards", text: "No tests, branch protection or input checks on that path." },
];

function SeverityChip({ level }: { level: Severity }) {
  return <span className={`threat-report-severity ${level}`}>{SEVERITY_LABEL[level]}</span>;
}

function RatingGuideModal({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose);
  const trapRef = useFocusTrap<HTMLDivElement>();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={trapRef} className="modal-card rating-guide" role="dialog" aria-modal="true" aria-labelledby="rating-guide-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close" autoFocus><Icon name="close" size={20} /></button>
        <h2 id="rating-guide-title">How findings are rated</h2>
        <p>Impact is the damage if someone exploits the threat. Probability is how likely that is.</p>
        <div className="rating-table-wrap">
          <table className="rating-table">
            <thead><tr><th scope="col">Level</th><th scope="col">Impact</th><th scope="col">Probability</th></tr></thead>
            <tbody>
              {RATING_ROWS.map(({ level, impact, probability }) => (
                <tr key={level}><th scope="row"><SeverityChip level={level} /></th><td>{impact}</td><td>{probability}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 id="rating-signals">Probability signals</h3>
        <div className="rating-table-wrap">
          <table className="rating-table" aria-labelledby="rating-signals">
            <thead><tr><th scope="col">Signal</th><th scope="col">Counts when</th></tr></thead>
            <tbody>
              {PROBABILITY_SIGNALS.map(({ name, text }) => <tr key={name}><th scope="row">{name}</th><td>{text}</td></tr>)}
            </tbody>
          </table>
        </div>
        <h3 id="rating-terms">Terms used</h3>
        <div className="rating-table-wrap">
          <table className="rating-table" aria-labelledby="rating-terms">
            <thead><tr><th scope="col">Term</th><th scope="col">Meaning</th></tr></thead>
            <tbody>
              {TERMS.map(({ name, text }) => <tr key={name}><th scope="row">{name}</th><td>{text}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FindingCard({ finding: f, reason, onTriage }: { finding: Finding; reason?: string; onTriage: (finding: Finding) => void }) {
  return (
    <article className="threat-card" aria-labelledby={`finding-${f.id}`}>
      <header className="threat-card-head">
        <div className="threat-card-top">
          <SeverityChip level={f.severity} />
          <h4 id={`finding-${f.id}`}>{f.title}</h4>
          <span className="threat-card-framework">{f.framework} · {f.category}</span>
        </div>
        <p className="threat-card-detail">{f.impactDetail}</p>
      </header>
      <dl className="threat-card-meta">
        <div><dt>Impact</dt><dd><SeverityChip level={f.exposure.impact} /><span>{f.exposure.impactLabel}</span></dd></div>
        <div><dt>Probability</dt><dd><SeverityChip level={f.exposure.probability} /><span>{PROBABILITY_MEANING[f.exposure.probability]}</span></dd></div>
        <div><dt>File</dt><dd><code>{f.file}</code></dd></div>
      </dl>
      <section className="threat-card-mitigation" aria-labelledby={`mitigation-${f.id}`}>
        <h5 id={`mitigation-${f.id}`}><Icon name="shield" size={18} /><span>Recommended mitigation · {f.topic}</span></h5>
        <p>{f.mitigation}</p>
      </section>
      <footer className="threat-card-footer">
        <div className="threat-card-controls">
          <span>Related regulations</span>
          <ul className="threat-report-tags">
            {f.regulatoryTags.map((tag) => <li className="threat-report-tag" key={tag}>{tag}</li>)}
          </ul>
        </div>
        <button type="button" className="threat-report-action" onClick={() => onTriage(f)}>
          {reason ? "Edit justification" : "Mark as False Positive"}
        </button>
      </footer>
      {reason && <p className="threat-card-reason"><strong>Marked as false positive:</strong> {reason}</p>}
    </article>
  );
}

export function ThreatsTab({ analysis, risks, nodeId, reasons, onTriage, onSelectNode, onShowInDiagram }: ThreatsTabProps) {
  const { findings, dfd } = analysis;
  const atRisk = risks.filter((risk) => risk.findings.length);
  const current = atRisk.find((risk) => risk.node.id === nodeId) ?? atRisk[0];
  const [guideOpen, setGuideOpen] = useState(false);
  const counts = countBySeverity(findings);

  return (
    <div className="threat-report-view">
      <section className="team-box threat-box" aria-label="Threat Modeling and Architectural Posture">
        <div className="threat-summary">
          <div className="threat-stat">
            <div className="threat-stat-head">
              <span className="threat-stat-label">By severity</span>
              <button type="button" className="rating-guide-open" onClick={() => setGuideOpen(true)} aria-label="How findings are rated" title="How findings are rated">
                <Icon name="info" size={18} />
              </button>
            </div>
            <div className="threat-stat-values">
              {counts.map(({ severity, count }) => <span key={severity} className={severity}><strong>{count}</strong>{SEVERITY_LABEL[severity]}</span>)}
            </div>
          </div>
          <div className="threat-stat">
            <span className="threat-stat-label">By framework</span>
            <div className="threat-stat-values">
              <span><strong>{byFramework(findings, "STRIDE").length}</strong>STRIDE</span>
              <span><strong>{byFramework(findings, "LINDDUN").length}</strong>LINDDUN</span>
            </div>
          </div>
          <div className="threat-stat">
            <span className="threat-stat-label">Components at risk</span>
            <div className="threat-stat-values"><span><strong>{atRisk.length}</strong>of {dfd.nodes.length} in the diagram</span></div>
          </div>
        </div>

        {current && (
          <div className="threat-browser">
            <nav className="threat-components" aria-label="Components with findings">
              {atRisk.map(({ node, findings: list, severity }) => (
                <button
                  key={node.id}
                  type="button"
                  className={node.id === current.node.id ? "threat-component active" : "threat-component"}
                  aria-pressed={node.id === current.node.id}
                  onClick={() => onSelectNode(node.id)}
                >
                  <span className="threat-component-name"><i className={`kind-${node.kind}`} aria-hidden="true" />{node.title}</span>
                  <span className={`threat-component-count ${severity}`} aria-label={`${list.length} findings`}>{list.length}</span>
                  <small>{KIND_LABEL[node.kind]} · {[...new Set(list.map((f) => f.file))].join(", ")}</small>
                </button>
              ))}
            </nav>

            <section className="threat-pane" aria-labelledby="threat-pane-title">
              <header className="threat-pane-header">
                <div>
                  <h3 id="threat-pane-title">{current.node.title}</h3>
                  <p>{KIND_LABEL[current.node.kind]} · {current.node.classification} · {current.findings.length} {current.findings.length === 1 ? "finding" : "findings"}</p>
                </div>
                <button type="button" className="threat-report-action" onClick={() => onShowInDiagram(current.node.id)}>Show in diagram</button>
              </header>
              {current.findings.map((f) => <FindingCard key={f.id} finding={f} reason={reasons[f.id]} onTriage={onTriage} />)}
            </section>
          </div>
        )}
      </section>
      {guideOpen && <RatingGuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
