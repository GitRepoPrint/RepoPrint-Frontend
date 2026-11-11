"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import { EDGE_COLOR } from "@/lib/dfd/graph";
import type { DfdFlowEdge } from "@/lib/dfd/graph";

/** Ligação com a legenda (ex.: "HTTPS REQUEST") desenhada em HTML por cima do SVG. */
export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected, data }: EdgeProps<DfdFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: selected ? "#a893ff" : EDGE_COLOR, strokeWidth: selected ? 3 : 2 }} />
      {data?.label && (
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
