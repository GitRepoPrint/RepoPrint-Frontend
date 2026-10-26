"use client";

import { DfdScene } from "@/components/dfd/dfd-scene";
import { Icon } from "@/components/ui/icon";
import type { DfdModel } from "@/lib/api/types";

type DfdTabProps = { model: DfdModel; onEdit: () => void };

export function DfdTab({ model, onEdit }: DfdTabProps) {
  return (
    <section className="dfd-preview-section" aria-labelledby="dfd-preview-title">
      <div className="dfd-preview-header">
        <div>
          <h2 id="dfd-preview-title">Inferred Architecture &amp; Data Flow Diagram</h2>
          <p>Visualizing {model.nodes.length} auto-extracted DFD nodes, trust boundaries, and linked STRIDE/LINDDUN threats.</p>
        </div>
        <button type="button" className="button dfd-edit-button" onClick={onEdit}><Icon name="external" size={16} /> Edit DFD in Full Canvas</button>
      </div>
      <DfdScene model={model} />
    </section>
  );
}
