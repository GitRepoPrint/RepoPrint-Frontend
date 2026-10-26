"use client";

import type { DragEvent } from "react";
import { Icon } from "@/components/ui/icon";
import type { DfdNodeKind } from "@/lib/api/types";

const TOOLS = [
  { kind: "external", icon: "code", label: "External Entity", description: "People & external systems" },
  { kind: "process", icon: "layers", label: "Process Node", description: "Services & operations" },
  { kind: "store", icon: "database", label: "Data Store", description: "Persistent storage" },
] as const;

type ToolboxProps = { onAdd: (kind: DfdNodeKind) => void; onConnectorHint: () => void };

export function Toolbox({ onAdd, onConnectorHint }: ToolboxProps) {
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
        <p>Drag elements onto the canvas</p>
      </div>
      <div className="toolbox-section-label">NODES <span>03</span></div>
      <div className="tool-list">
        {TOOLS.map((tool) => (
          <button key={tool.kind} type="button" className="tool-item" draggable onDragStart={(event) => startDrag(event, tool.kind)} onClick={() => onAdd(tool.kind)}>
            <span className={`tool-icon ${tool.kind}`}><Icon name={tool.icon} size={18} /></span>
            <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
            <Icon name="plus" size={15} className="tool-plus" />
          </button>
        ))}
      </div>
      <div className="toolbox-section-label flow-section-label">CONNECTORS <span>01</span></div>
      <button type="button" className="tool-item" onClick={onConnectorHint}>
        <span className="tool-icon connector"><Icon name="flow" size={18} /></span>
        <span><strong>Data Flow</strong><small>Connect two components</small></span>
        <Icon name="plus" size={15} className="tool-plus" />
      </button>
      <div className="toolbox-tip"><Icon name="info" size={16} /><span>Tip: Click a component to inspect its security findings.</span></div>
      <div className="toolbox-bottom"><span className="status-dot green" /> Analysis synced <Icon name="check" size={14} /></div>
    </aside>
  );
}
