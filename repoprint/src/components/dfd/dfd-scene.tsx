"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { componentsInsideBoundary, describeFlows, nodeConnections } from "@/lib/dfd/flows";
import type { DfdModel, DfdNodeData, DfdNodeKind, Severity } from "@/lib/api/types";

export const KIND_LABEL: Record<DfdNodeKind, string> = { external: "external entity", process: "process", store: "data store" };

export type NodeRiskSummary = { severity: Severity | null; count: number };

// Cilindro da base de dados; (cx, cy) é o centro e a forma é fixa (146 de largura, 70 de altura).
function storePath(cx: number, cy: number) {
  const top = cy - 35, ellipseY = cy - 20, bottom = cy + 35;
  return `M${cx - 73} ${ellipseY} C${cx - 73} ${cy - 29} ${cx - 41} ${top} ${cx} ${top} C${cx + 41} ${top} ${cx + 73} ${cy - 29} ${cx + 73} ${ellipseY} V${cy + 20} C${cx + 73} ${cy + 29} ${cx + 41} ${bottom} ${cx} ${bottom} C${cx - 41} ${bottom} ${cx - 73} ${cy + 29} ${cx - 73} ${cy + 20} Z`;
}

function titleLines(title: string) {
  const space = title.indexOf(" ");
  return title.length < 12 || space < 0 ? [title] : [title.slice(0, space), title.slice(space + 1)];
}

function ProcessLabel({ node }: { node: DfdNodeData }) {
  const lines = titleLines(node.title);
  const top = node.y - (lines.length === 2 ? 12 : 3);
  return (
    <>
      {lines.map((line, index) => (
        <text key={line} className="dfd-node-title" x={node.x} y={top + index * 15} textAnchor="middle">{line}</text>
      ))}
      <text className="dfd-node-type" x={node.x} y={top + lines.length * 15 + 2} textAnchor="middle">{node.subtitle}</text>
    </>
  );
}

function NodeShape({ node }: { node: DfdNodeData }) {
  const { x, y } = node;
  if (node.kind === "external") {
    return (
      <>
        <rect x={x - 66} y={y - 27} width="132" height="54" rx="5" />
        <text className="dfd-node-title" x={x} y={y - 4} textAnchor="middle">{node.title}</text>
        <text className="dfd-node-type" x={x} y={y + 13} textAnchor="middle">{node.subtitle}</text>
      </>
    );
  }
  if (node.kind === "process") {
    return (
      <>
        <circle cx={x} cy={y} r="43" />
        <ProcessLabel node={node} />
      </>
    );
  }
  return (
    <>
      <path d={storePath(x, y)} />
      <ellipse cx={x} cy={y - 20} rx="73" ry="15" />
      <text className="dfd-node-title" x={x} y={y + 5} textAnchor="middle">{node.title}</text>
      <text className="dfd-node-type" x={x} y={y + 21} textAnchor="middle">{node.subtitle}</text>
    </>
  );
}

function badgePosition(node: DfdNodeData) {
  if (node.kind === "external") return { x: node.x + 62, y: node.y - 25 };
  if (node.kind === "process") return { x: node.x + 31, y: node.y - 31 };
  return { x: node.x + 66, y: node.y - 28 };
}

type DfdSceneProps = {
  model: DfdModel;
  risk: Record<string, NodeRiskSummary>;
  selected: string | null;
  onSelect: (id: string) => void;
};

/** Prévia interativa (zoom e seleção de nós) do DFD no dashboard. O canvas editável será outro componente. */
export function DfdScene({ model, risk, selected, onSelect }: DfdSceneProps) {
  const [zoom, setZoom] = useState(100);
  const { boundary } = model;
  const flows = describeFlows(model);

  function onKey(event: KeyboardEvent, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
    }
  }

  return (
    <div className="dfd-preview">
      <div className="dfd-preview-viewport">
        <div className="dfd-preview-scene" style={{ transform: `scale(${zoom / 100})` }}>
          <svg className="dfd-preview-svg" viewBox="0 0 1000 320" role="group" aria-label="Data flow diagram. Each component and data flow can be read below; a table of all data flows follows the diagram.">
            <defs>
              <marker id="dfd-preview-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#85859a" /></marker>
            </defs>
            <rect className="dfd-trust-boundary" x={boundary.x} y={boundary.y} width={boundary.width} height={boundary.height} rx="13" role="img" aria-label={`Trust boundary: ${boundary.label}, contains ${componentsInsideBoundary(model)} components`} />
            <text className="dfd-boundary-label" x={boundary.x + 20} y={boundary.y + 22} aria-hidden="true">{boundary.label}</text>
            {model.flows.map((d, index) => (
              <path key={d} className="dfd-flow-link" d={d} markerEnd="url(#dfd-preview-arrow)" role="img" aria-label={flows[index]?.sentence ?? "Data flow"} />
            ))}
            {model.nodes.map((node) => {
              const { severity, count } = risk[node.id] ?? { severity: null, count: 0 };
              const badge = badgePosition(node);
              const label = count ? `${count} ${count === 1 ? "finding" : "findings"}, highest ${severity}` : "no findings";
              const links = nodeConnections(model, node.id);
              const linkText = [links.receivesFrom.length ? `receives data from ${links.receivesFrom.join(", ")}` : "", links.sendsTo.length ? `sends data to ${links.sendsTo.join(", ")}` : ""].filter(Boolean).join("; ");
              return (
                <g
                  key={node.id}
                  className={`dfd-node dfd-node-${node.kind} risk-${severity ?? "none"}${selected === node.id ? " selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${node.title} ${KIND_LABEL[node.kind]}, ${label}${linkText ? `; ${linkText}` : ""}`}
                  aria-pressed={selected === node.id}
                  onClick={() => onSelect(node.id)}
                  onKeyDown={(event) => onKey(event, node.id)}
                >
                  <NodeShape node={node} />
                  {count > 0 && (
                    <g className="dfd-node-badge" aria-hidden="true">
                      <circle cx={badge.x} cy={badge.y} r="14" />
                      <text x={badge.x} y={badge.y + 4} textAnchor="middle">{`${severity?.[0].toUpperCase() ?? ""}${count}`}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div className="dfd-preview-footer">
        <ul className="dfd-risk-key" aria-label="Legend">
          <li><i className="risk-high" />High, solid outline</li>
          <li><i className="risk-medium" />Medium, dashed</li>
          <li><i className="risk-low" />Low, dotted</li>
          <li><i className="risk-none" />No findings</li>
          <li><i className="risk-boundary" />Trust boundary: separates your code from external systems</li>
          <li>Badge: highest severity letter and number of findings (H2 = 2 findings, highest High)</li>
        </ul>
        <div className="dfd-preview-toolbar" aria-label="Diagram preview controls">
          <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(70, v - 10))}><Icon name="minus" size={15} /></button>
          <span className="dfd-preview-zoom">{zoom}%</span>
          <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((v) => Math.min(140, v + 10))}><Icon name="plus" size={15} /></button>
          <span className="dfd-toolbar-divider" />
          <button type="button" className="dfd-reset-button" onClick={() => setZoom(100)}>Reset View</button>
          <span className="dfd-live-sync"><span />Live Sync</span>
        </div>
      </div>
    </div>
  );
}
