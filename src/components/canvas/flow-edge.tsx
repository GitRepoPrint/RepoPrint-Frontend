"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import { edgeStyle } from "@/lib/dfd/declutter";
import { EDGE_COLOR } from "@/lib/dfd/graph";
import type { DfdFlowEdge } from "@/lib/dfd/graph";

/**
 * Ligação com a legenda (ex.: "HTTPS REQUEST") desenhada em HTML por cima do SVG. Um fluxo de dados é firme e tem legenda; uma dependência
 * (um código que usa outro) é fina, a tracejado e sem legenda; o que não toca no que está selecionado esmaece (declutter.ts).
 */
export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, markerStart, selected, data }: EdgeProps<DfdFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const look = edgeStyle(data?.kind ?? "flow", selected ? "active" : (data?.state ?? "normal"));

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{ stroke: selected ? "#a893ff" : EDGE_COLOR, strokeWidth: look.width, opacity: look.opacity, strokeDasharray: look.dash }}
      />
      {data?.label && look.showLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <span className="flow-label static!">{data.label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
