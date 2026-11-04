import { Icon } from "@/components/ui/icon";
import { prioritize, SEVERITY_LABEL } from "@/lib/findings";
import { KIND_LABEL } from "@/lib/dfd/graph";
import type { DfdFlowNode } from "@/lib/dfd/graph";
import type { Finding } from "@/lib/api/types";
import { NODE_ICON } from "./dfd-node";

type InspectorProps = { node: DfdFlowNode | undefined; findings: Finding[] };

const GENERIC_RECOMMENDATION = "Review trust boundaries and validate all data entering or leaving this component.";

export function Inspector({ node, findings }: InspectorProps) {
  const nodeFindings = node ? findings.filter((f) => node.data.findingIds.includes(f.id)) : [];
  const top = prioritize(nodeFindings)[0];
  const count = String(nodeFindings.length).padStart(2, "0");

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div><span className="section-kicker">NODE INSPECTOR</span><h2>Properties</h2></div>
        <Icon name="more" size={19} />
      </div>
      <div className="inspector-body">
        {!node ? (
          <div className="empty-findings"><Icon name="info" size={20} /> Select a component to inspect its security findings.</div>
        ) : (
          <>
            <div className="selected-node-card">
              <div className={`selected-node-icon ${node.data.kind}`}><Icon name={NODE_ICON[node.data.kind]} size={23} /></div>
              <div>
                <strong>{node.data.title}</strong>
                <span>{node.data.subtitle === KIND_LABEL[node.data.kind] ? node.data.subtitle : `${KIND_LABEL[node.data.kind]} / ${node.data.subtitle}`}</span>
              </div>
              <span className="selected-indicator" />
            </div>
            <div className="property-row"><span>CLASSIFICATION</span><strong>{node.data.classification}</strong></div>
            <div className="property-row"><span>NODE ID</span><strong className="mono">{node.data.code}</strong></div>
            <div className="inspector-divider" />
            <div className="findings-title">SECURITY FINDINGS <span>{nodeFindings.length > 0 ? `${count} ACTIVE` : "NO ACTIVE"}</span></div>
            {nodeFindings.length > 0 ? (
              nodeFindings.map((f) => (
                <div key={f.id} className={`finding-card ${f.framework.toLowerCase()}`}>
                  <div className="finding-head">
                    <span><Icon name={f.framework === "STRIDE" ? "warning" : "lock"} size={15} /> {f.framework} {f.framework === "STRIDE" ? "FINDING" : "RISK"}</span>
                    <span className="finding-severity">{SEVERITY_LABEL[f.severity].toUpperCase()}</span>
                  </div>
                  <strong>{f.category}</strong>
                  <p>{f.impactDetail}</p>
                  <span className="finding-ref">{f.framework} · {f.ref}</span>
                </div>
              ))
            ) : (
              <div className="empty-findings"><Icon name="shield" size={20} /> No active findings for this node.</div>
            )}
            <div className="recommendation">
              <div className="recommendation-heading">
                <span><Icon name="shield" size={16} /> MITIGATION</span>
                {top && <span className="ai-tag">{top.topic}</span>}
              </div>
              <p>{top ? top.mitigation : GENERIC_RECOMMENDATION}</p>
            </div>
          </>
        )}
      </div>
      <div className="inspector-footer"><Icon name="shield" size={15} /> Findings generated from repository analysis</div>
    </aside>
  );
}
