"use client";

import type { DragEvent, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import type { DfdNodeKind } from "@/lib/api/types";
import { KIND_LABEL } from "@/lib/dfd/graph";
import { NODE_ICON } from "./dfd-node";

// Nome e ícone vêm das mesmas constantes usadas pelos nós e pelo inspector.
const TOOLS: { kind: DfdNodeKind; description: string }[] = [
  { kind: "external", description: "People & external systems" },
  { kind: "process", description: "Services & operations" },
  { kind: "store", description: "Persistent storage" },
];

type ToolboxProps = { onAdd: (kind: DfdNodeKind) => void; connectOpen: boolean; onToggleConnect: () => void; connectPanel: ReactNode };

export function Toolbox({ onAdd, connectOpen, onToggleConnect, connectPanel }: ToolboxProps) {
  // O tipo do nó viaja no próprio arrasto; o canvas lê-o no onDrop.
  const startDrag = (event: DragEvent, kind: DfdNodeKind) => {
    event.dataTransfer.setData("node-kind", kind);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="toolbox">
      <div className="sidebar-heading">
        <span className="section-kicker">BUILD YOUR MODEL</span>
        <h2>Components</h2>
        <p>Drag or click to add elements</p>
      </div>
      <div className="toolbox-section-label">NODES <span>03</span></div>
      <div className="tool-list">
        {TOOLS.map((tool) => (
          <button key={tool.kind} type="button" className="tool-item" draggable onDragStart={(event) => startDrag(event, tool.kind)} onClick={() => onAdd(tool.kind)}>
            <span className={`tool-icon ${tool.kind}`}><Icon name={NODE_ICON[tool.kind]} size={18} /></span>
            <span><strong>{KIND_LABEL[tool.kind]}</strong><small>{tool.description}</small></span>
            <Icon name="plus" size={15} className="tool-plus" />
          </button>
        ))}
      </div>
      <div className="toolbox-section-label flow-section-label">CONNECTORS <span>01</span></div>
      <button type="button" className="tool-item" onClick={onToggleConnect} aria-expanded={connectOpen} aria-controls="connect-panel">
        <span className="tool-icon connector"><Icon name="flow" size={18} /></span>
        <span><strong>Data Flow</strong><small>Connect two components</small></span>
        <Icon name={connectOpen ? "minus" : "plus"} size={15} className="tool-plus" />
      </button>
      {connectOpen && connectPanel}
      <div className="toolbox-tip"><Icon name="info" size={16} /><span>Tip: Click a component to inspect its security findings.</span></div>
      <div className="toolbox-bottom"><span className="status-dot green" /> Analysis synced <Icon name="check" size={14} /></div>
    </aside>
  );
}
