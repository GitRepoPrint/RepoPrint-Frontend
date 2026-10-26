"use client";

import { useReactFlow, useStore } from "@xyflow/react";
import { Icon } from "@/components/ui/icon";

// `.toolbar-right button` (mockup) tem mais especificidade que `.button-primary` e deixava o botão sem cor própria.
const PRIMARY_FIX =
  "bg-[#a691ff]! border-[#b9aaff]! text-[#151023]! [.theme-light_&]:bg-[#7259d6]! [.theme-light_&]:border-[#7259d6]! [.theme-light_&]:text-white!";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;

type CanvasToolbarProps = {
  repository: string;
  branch: string;
  dirty: boolean;
  onBack: () => void;
  onLayout: () => void;
  onSave: () => void;
  onExport: () => void;
};

export function CanvasToolbar({ repository, branch, dirty, onBack, onLayout, onSave, onExport }: CanvasToolbarProps) {
  const { zoomTo } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);

  // Passos de 10 pontos percentuais a partir do zoom atual (o "ajustar à vista" inicial pode dar 65%, por exemplo).
  const stepZoom = (delta: number) => {
    zoomTo(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta)), { duration: 150 });
  };

  return (
    <div className="canvas-toolbar canvas-main-toolbar">
      <div className="canvas-toolbar-context">
        <button type="button" className="canvas-breadcrumb" onClick={onBack}><Icon name="arrow" size={15} /> Overview</button>
        <span className="crumb-slash">/</span>
        <span className="canvas-repo-name">{repository}</span>
        <span className="canvas-branch">{branch}</span>
        <span className="toolbar-divider" />
        <span className="canvas-title-icon"><Icon name="flow" size={16} /></span>
        <strong>Data Flow Diagram</strong>
      </div>
      <div className="toolbar-right">
        <span className={`saved-state ${dirty ? "text-[#c28a2c]!" : ""}`} role="status">
          <span className={`status-dot ${dirty ? "bg-[#e9b44c]" : "green"}`} /> {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <span className="live-badge"><span className="status-dot green" /> LIVE CANVAS</span>
        <span className="toolbar-divider" />
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => stepZoom(-0.1)}><Icon name="minus" size={16} /></button>
        <span className="zoom-text">{Math.round(zoom * 100)}%</span>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => stepZoom(0.1)}><Icon name="plus" size={16} /></button>
        <button type="button" className="canvas-toolbar-command button button-outline inline-flex! flex-row!" onClick={onLayout}><Icon name="grid" size={16} /> Auto Layout</button>
        <button type="button" className="canvas-toolbar-command button button-outline inline-flex! flex-row!" onClick={onSave}><Icon name="save" size={16} /> Save Diagram</button>
        <button type="button" className={`canvas-toolbar-command button button-primary inline-flex! flex-row! ${PRIMARY_FIX}`} onClick={onExport}><Icon name="download" size={16} /> Export SVG</button>
      </div>
    </div>
  );
}
