"use client";

import { useMemo, useState } from "react";
import { DfdScene, KIND_LABEL } from "@/components/dfd/dfd-scene";
import { Icon } from "@/components/ui/icon";
import { useRepositoryDfd } from "@/hooks/use-repository-dfd";
import type { DetailState } from "@/hooks/use-repository-dfd";
import { combineGraphs } from "@/lib/dfd/combine";
import { project } from "@/lib/dfd/project";
import { graphToDfdModel } from "@/lib/dfd/to-model";
import { isDemoRepository } from "@/lib/api/repositories";
import { risksByNode, SEVERITY_LABEL } from "@/lib/findings";
import type { DfdEvidence, DfdModel, DfdNodeData, Finding } from "@/lib/api/types";

type DfdTabProps = {
  repository: string;
  /** O diagrama de demonstração: é o que se mostra nos repositórios de demonstração. */
  demoModel: DfdModel;
  findings: Finding[];
  nodeId: string;
  onSelectNode: (id: string) => void;
  onOpenThreats: (id: string) => void;
  onEdit: () => void;
};

export function DfdTab({ repository, demoModel, findings, nodeId, onSelectNode, onOpenThreats, onEdit }: DfdTabProps) {
  if (isDemoRepository(repository)) {
    return <DfdPanel repository={repository} model={demoModel} findings={findings} nodeId={nodeId} onSelectNode={onSelectNode} onOpenThreats={onOpenThreats} onEdit={onEdit} />;
  }
  return <LiveDfdTab repository={repository} findings={findings} onOpenThreats={onOpenThreats} onEdit={onEdit} />;
}

function LiveDfdTab({ repository, findings, onOpenThreats, onEdit }: Pick<DfdTabProps, "repository" | "findings" | "onOpenThreats" | "onEdit">) {
  const { dfd, retry, detail, loadDetail, detailAvailable } = useRepositoryDfd(repository);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  // Com a análise do código junta-se ao overview; sem ela, o overview é o que há. O que está aberto decide o que se vê.
  const overview = dfd.status === "ready" ? dfd.graph : null;
  const graph = useMemo(() => (overview ? (detail.status === "ready" ? combineGraphs(overview, detail.graph) : overview) : null), [overview, detail]);
  const view = useMemo(() => (graph ? project(graph, { expanded }) : null), [graph, expanded]);
  const model = useMemo(() => (view ? graphToDfdModel(view) : null), [view]);

  if (dfd.status === "loading") {
    return (
      <div className="dfd-state" role="status">
        <span className="analysis-spinner large" />
        <div>
          <strong>Inferring the architecture</strong>
          <span>Reading the compose files, Dockerfiles and manifests of {repository}…</span>
        </div>
      </div>
    );
  }

  if (dfd.status === "error") {
    return (
      <div className="dfd-state dfd-state-error" role="alert">
        <Icon name="warning" size={22} />
        <div>
          <strong>Could not infer the diagram</strong>
          <span>{dfd.message}</span>
        </div>
        <button type="button" className="button button-outline" onClick={retry}>Try again</button>
      </div>
    );
  }

  if (!graph || !view || !model) return null;

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const stats = detail.status === "ready" ? (graph.meta.stats as { files_parsed?: number } | undefined) : undefined;

  // Ao abrir, o primeiro processo: é onde a arquitetura começa a fazer sentido (as entidades externas vêm antes na lista)
  const first = model.nodes.find((n) => n.kind === "process") ?? model.nodes[0];
  return (
    <DfdPanel
      repository={repository}
      model={model}
      findings={findings}
      nodeId={selected ?? first?.id ?? ""}
      onSelectNode={setSelected}
      onOpenThreats={onOpenThreats}
      onEdit={onEdit}
      onToggleExpand={toggle}
      detail={{
        available: detailAvailable,
        state: detail,
        onLoad: loadDetail,
        canExpand: Object.keys(view.children).length > 0,
        anyOpen: expanded.size > 0,
        onExpandAll: () => setExpanded(new Set(Object.keys(view.children))),
        onCollapseAll: () => setExpanded(new Set()),
      }}
      inferred={{
        partial: dfd.partial,
        files: (dfd.graph.meta.inputs as string[] | undefined)?.length ?? 0,
        fallback: dfd.graph.meta.fallback as string | undefined,
        codeFiles: detail.status === "ready" ? (stats?.files_parsed ?? 0) : undefined,
      }}
    />
  );
}

type DetailControls = {
  /** Há um backend de análise de código configurado. */
  available: boolean;
  state: DetailState;
  onLoad: () => void;
  canExpand: boolean;
  anyOpen: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

type PanelProps = Omit<DfdTabProps, "demoModel"> & {
  model: DfdModel;
  inferred?: { partial: boolean; files: number; fallback?: string; codeFiles?: number };
  detail?: DetailControls;
  onToggleExpand?: (id: string) => void;
};

function DetailBar({ detail }: { detail: DetailControls }) {
  const { state } = detail;
  return (
    <div className="dfd-detail-controls">
      {state.status === "idle" && (
        <button type="button" className="button button-outline" onClick={detail.onLoad}><Icon name="code" size={15} /> Add code-level detail</button>
      )}
      {state.status === "loading" && (
        <span role="status"><span className="analysis-spinner" /> Reading the source code… this can take a minute.</span>
      )}
      {state.status === "error" && (
        <>
          <span className="dfd-detail-error" role="alert">{state.message}</span>
          <button type="button" className="button button-outline" onClick={detail.onLoad}>Try again</button>
        </>
      )}
      {state.status === "ready" && (
        <>
          <button type="button" className="button button-outline" disabled={!detail.canExpand} onClick={detail.onExpandAll}>Expand all</button>
          <button type="button" className="button button-outline" disabled={!detail.anyOpen} onClick={detail.onCollapseAll}>Collapse all</button>
        </>
      )}
    </div>
  );
}

const githubLink = (repository: string, evidence: DfdEvidence) =>
  `https://github.com/${repository}/blob/HEAD/${evidence.file!.split("/").map(encodeURIComponent).join("/")}${evidence.line ? `#L${evidence.line}` : ""}`;

function Evidence({ repository, node }: { repository: string; node: DfdNodeData }) {
  return (
    <ul className="dfd-evidence" aria-label={`Where ${node.title} comes from`}>
      {node.evidence?.map((item, index) => (
        <li key={index}>
          {item.file ? (
            <a href={githubLink(repository, item)} target="_blank" rel="noreferrer">
              <code>{item.file}{item.line ? `:${item.line}` : ""}</code>
            </a>
          ) : null}
          {item.note ? <span>{item.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function DfdPanel({ repository, model, findings, nodeId, onSelectNode, onOpenThreats, onEdit, inferred, detail, onToggleExpand }: PanelProps) {
  const risks = risksByNode(model, findings);
  const current = risks.find((risk) => risk.node.id === nodeId) ?? risks[0];
  const summary = Object.fromEntries(risks.map((risk) => [risk.node.id, { severity: risk.severity, count: risk.findings.length }]));
  if (!current) return <p className="dfd-node-empty">There is nothing to show for this repository yet.</p>;
  const { node, findings: nodeFindings } = current;

  return (
    <div className="dfd-tab">
      <div className="dfd-tab-header">
        {detail?.available && <DetailBar detail={detail} />}
        <button type="button" className="button dfd-edit-button" onClick={onEdit}><Icon name="external" size={16} /> Edit DFD in Full Canvas</button>
      </div>
      {inferred && (
        <p className="dfd-notice" role="note">
          <Icon name="info" size={16} />
          <span>
            {inferred.fallback === "application"
              ? "No compose files or Dockerfiles were found, so this is one application with what its dependencies reveal."
              : `Inferred from ${inferred.files} configuration file${inferred.files === 1 ? "" : "s"} (compose, Dockerfiles, manifests).`}{" "}
            {inferred.codeFiles === undefined
              ? "Source code is not read here."
              : `Combined with the code analysis (${inferred.codeFiles} source files read): open a component to see its parts.`}
            {inferred.partial && " Some files could not be read, so the diagram may be incomplete."}
          </span>
        </p>
      )}
      <section className="dfd-preview-section" aria-label="Inferred Architecture and Data Flow Diagram">
        <div className="dfd-layout">
          <DfdScene model={model} risk={summary} selected={node.id} onSelect={onSelectNode} />
          <aside className="dfd-node-panel" aria-live="polite" aria-labelledby="dfd-node-title">
            <div className="dfd-node-panel-head">
              <span className="dfd-node-panel-kicker">Selected component</span>
              <h3 id="dfd-node-title">{node.title}</h3>
              <p className="dfd-node-panel-meta">{KIND_LABEL[node.kind]} · {node.classification} · <code>{node.code}</code></p>
              {node.confidence && (
                <p className="dfd-node-panel-meta">
                  <span className={`dfd-confidence ${node.confidence}`}>{node.confidence} confidence</span>
                  {node.technology ? <> · {node.technology}</> : null}
                </p>
              )}
              {node.facts && node.facts.length > 0 && <p className="dfd-node-panel-meta">{node.facts.join(" · ")}</p>}
              {node.expandable && onToggleExpand ? (
                <button type="button" className="button button-outline dfd-node-open" onClick={() => onToggleExpand(node.id)} aria-expanded={node.expanded}>
                  {node.expanded ? "Collapse parts" : `Show ${node.expandable} ${node.expandable === 1 ? "part" : "parts"}`}
                </button>
              ) : null}
              {nodeFindings.length > 0 && (
                <button type="button" className="button button-primary dfd-node-open" onClick={() => onOpenThreats(node.id)}>
                  Open in Threat Modeling
                </button>
              )}
            </div>
            {node.evidence ? (
              <div>
                <span className="dfd-node-panel-kicker">Where this comes from</span>
                <Evidence repository={repository} node={node} />
              </div>
            ) : nodeFindings.length ? (
              <ul className="dfd-node-findings">
                {nodeFindings.map((f) => (
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
      </section>
    </div>
  );
}
