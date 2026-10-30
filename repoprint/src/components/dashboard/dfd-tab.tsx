"use client";

import { DfdScene } from "@/components/dfd/dfd-scene";
import { Icon } from "@/components/ui/icon";
import type { DfdModel } from "@/lib/api/types";

type DfdTabProps = { model: DfdModel; onEdit: () => void };

export function DfdTab({ model, onEdit }: DfdTabProps) {
  return (
    <div className="dfd-tab">
      <header className="tab-page-header dfd-tab-header">
        <h2 id="dfd-preview-title">Inferred Architecture &amp; Data Flow Diagram</h2>
        <button type="button" className="button dfd-edit-button" onClick={onEdit}><Icon name="external" size={16} /> Edit DFD in Full Canvas</button>
      </header>
      <section className="dfd-preview-section" aria-labelledby="dfd-preview-title">
        <DfdScene model={model} />
      </section>
    </div>
  );
}
