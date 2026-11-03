"use client";

import { DfdScene, KIND_LABEL } from "@/components/dfd/dfd-scene";
import { Icon } from "@/components/ui/icon";
import { describeFlows, nodeConnections } from "@/lib/dfd/flows";
import { SEVERITY_LABEL } from "@/lib/findings";
import type { NodeRisk } from "@/lib/findings";
import type { DfdModel } from "@/lib/api/types";

type DfdTabProps = {
  model: DfdModel;
  risks: NodeRisk[];
  nodeId: string;
  onSelectNode: (id: string) => void;
  onOpenThreats: (id: string) => void;
  onEdit: () => void;
};

export function DfdTab({ model, risks, nodeId, onSelectNode, onOpenThreats, onEdit }: DfdTabProps) {
  const current = risks.find((risk) => risk.node.id === nodeId) ?? risks[0];
  const summary = Object.fromEntries(risks.map((risk) => [risk.node.id, { severity: risk.severity, count: risk.findings.length }]));
  const { node, findings } = current;
  const flows = describeFlows(model);
  const links = nodeConnections(model, node.id);

  return (
    <div className="dfd-tab">
      <div className="dfd-tab-header">
        <button type="button" className="button dfd-edit-button" onClick={onEdit}><Icon name="external" size={16} /> Edit DFD in Full Canvas</button>
      </div>
      <section className="dfd-preview-section" aria-label="Inferred Architecture and Data Flow Diagram">
        <div className="dfd-layout">
          <DfdScene model={model} risk={summary} selected={node.id} onSelect={onSelectNode} />
          <aside className="dfd-node-panel" aria-live="polite" aria-labelledby="dfd-node-title">
            <div className="dfd-node-panel-head">
              <span className="dfd-node-panel-kicker">Selected component</span>
              <h3 id="dfd-node-title">{node.title}</h3>
              <p className="dfd-node-panel-meta">{KIND_LABEL[node.kind]} · {node.classification} · <code>{node.code}</code></p>
              <p className="sr-only">
                Receives data from {links.receivesFrom.join(", ") || "nothing"}. Sends data to {links.sendsTo.join(", ") || "nothing"}.
              </p>
              {findings.length > 0 && (
                <button type="button" className="button button-primary dfd-node-open" onClick={() => onOpenThreats(node.id)}>
                  Open in Threat Modeling
                </button>
              )}
            </div>
            {findings.length ? (
              <ul className="dfd-node-findings">
                {findings.map((f) => (
                  <li key={f.id}>
                    <div className="dfd-node-finding-top">
                      <span className={`threat-report-severity ${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
                      <strong>{f.title}</strong>
                    </div>
                    <span>{f.framework} · {f.category}</span>
                    <code>{f.file}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dfd-node-empty">No findings on this component.</p>
            )}
          </aside>
        </div>
        <div className="dfd-flows">
          <h3 id="dfd-flows-title">Data flows</h3>
          <div className="dfd-flows-wrap">
            <table className="dfd-flows-table" aria-labelledby="dfd-flows-title">
              <thead>
                <tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Data</th><th scope="col">Crosses trust boundary</th></tr>
              </thead>
              <tbody>
                {flows.map((flow) => (
                  <tr key={flow.id}><td>{flow.from}</td><td>{flow.to}</td><td>{flow.data}</td><td>{flow.crossesBoundary ? "Yes" : "No"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
