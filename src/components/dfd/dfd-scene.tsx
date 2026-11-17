"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { titleLines } from "@/lib/dfd/labels";
import type { DfdModel, DfdNodeData, DfdNodeKind, Severity } from "@/lib/api/types";

export const KIND_LABEL: Record<DfdNodeKind, string> = { external: "external entity", process: "process", store: "data store" };

export type NodeRiskSummary = { severity: Severity | null; count: number };

// Cilindro da base de dados; (cx, cy) é o centro e a forma é fixa (146 de largura, 70 de altura).
function storePath(cx: number, cy: number) {
  const top = cy - 35, ellipseY = cy - 20, bottom = cy + 35;
  return `M${cx - 73} ${ellipseY} C${cx - 73} ${cy - 29} ${cx - 41} ${top} ${cx} ${top} C${cx + 41} ${top} ${cx + 73} ${cy - 29} ${cx + 73} ${ellipseY} V${cy + 20} C${cx + 73} ${cy + 29} ${cx + 41} ${bottom} ${cx} ${bottom} C${cx - 41} ${bottom} ${cx - 73} ${cy + 29} ${cx - 73} ${cy + 20} Z`;
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

/** Um título mais largo do que a forma é espremido até caber (um endereço como "maxcdn.bootstrapcdn.com" não se parte bem). */
const fitTo = (title: string, width: number) => (title.length * 7.4 > width ? { textLength: width, lengthAdjust: "spacingAndGlyphs" as const } : {});

function NodeShape({ node }: { node: DfdNodeData }) {
  const { x, y } = node;
  if (node.kind === "external") {
    return (
      <>
        <rect x={x - 66} y={y - 27} width="132" height="54" rx="5" />
        <text className="dfd-node-title" x={x} y={y - 4} textAnchor="middle" {...fitTo(node.title, 116)}>{node.title}</text>
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
      <text className="dfd-node-title" x={x} y={y + 5} textAnchor="middle" {...fitTo(node.title, 128)}>{node.title}</text>
      <text className="dfd-node-type" x={x} y={y + 21} textAnchor="middle">{node.subtitle}</text>
    </>
  );
}

/** Onde fica a marca "+n" de um componente que se pode abrir: no canto de baixo, do lado oposto ao dos findings. */
function expandBadgePosition(node: DfdNodeData) {
  if (node.kind === "external") return { x: node.x + 62, y: node.y + 25 };
  if (node.kind === "process") return { x: node.x + 31, y: node.y + 31 };
  return { x: node.x + 66, y: node.y + 28 };
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
  const { boundary, viewBox } = model;

  function onKey(event: KeyboardEvent, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
    }
  }

  return (
    <div className="dfd-preview">
      <div className={`dfd-preview-viewport${viewBox ? " dfd-preview-viewport-fit" : ""}`}>
        <div className={`dfd-preview-scene${viewBox ? " dfd-preview-scene-fit" : ""}`} style={{ transform: `scale(${zoom / 100})` }}>
          <svg className="dfd-preview-svg" viewBox={`0 0 ${viewBox?.width ?? 1000} ${viewBox?.height ?? 320}`} role="img" aria-label="Interactive data flow diagram with external entities, backend processes, data stores and the findings on each component">
            <defs>
              <marker id="dfd-preview-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#85859a" /></marker>
            </defs>
            {boundary && (
              <>
                <rect className="dfd-trust-boundary" x={boundary.x} y={boundary.y} width={boundary.width} height={boundary.height} rx="13" />
                <text className="dfd-boundary-label" x={boundary.x + 20} y={boundary.y + 22}>{boundary.label}</text>
              </>
            )}
            {model.containment?.map((d, index) => <path key={`c${index}:${d}`} className="dfd-contain-link" d={d} />)}
            {model.flows.map((d, index) => <path key={`${index}:${d}`} className="dfd-flow-link" d={d} markerEnd="url(#dfd-preview-arrow)" />)}
            {model.nodes.map((node) => {
              const { severity, count } = risk[node.id] ?? { severity: null, count: 0 };
              const badge = badgePosition(node);
              const findingsLabel = count ? `${count} ${count === 1 ? "finding" : "findings"}, highest ${severity}` : "no findings";
              const label = node.expandable ? `${findingsLabel}, ${node.expanded ? "showing" : "has"} ${node.expandable} ${node.expandable === 1 ? "part" : "parts"}` : findingsLabel;
              const more = expandBadgePosition(node);
              return (
                <g
                  key={node.id}
                  className={`dfd-node dfd-node-${node.kind} risk-${severity ?? "none"}${selected === node.id ? " selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${node.title} ${KIND_LABEL[node.kind]}, ${label}`}
                  aria-pressed={selected === node.id}
                  onClick={() => onSelect(node.id)}
                  onKeyDown={(event) => onKey(event, node.id)}
                >
                  <NodeShape node={node} />
                  {node.expandable && !node.expanded ? (
                    <g className="dfd-node-expand" aria-hidden="true">
                      <circle cx={more.x} cy={more.y} r="11" />
                      <text x={more.x} y={more.y + 4} textAnchor="middle">+{node.expandable}</text>
                    </g>
                  ) : null}
                  {count > 0 && (
                    <g className="dfd-node-badge" aria-hidden="true">
                      <circle cx={badge.x} cy={badge.y} r="11" />
                      <text x={badge.x} y={badge.y + 4} textAnchor="middle">{count}</text>
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
          <li><i className="risk-high" />High</li>
          <li><i className="risk-medium" />Medium</li>
          <li><i className="risk-low" />Low</li>
          <li><i className="risk-none" />No findings</li>
          <li>Number shows the findings on each component</li>
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
