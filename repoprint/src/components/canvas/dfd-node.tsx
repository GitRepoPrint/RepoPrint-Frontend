"use client";

import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Icon } from "@/components/ui/icon";
import type { DfdFlowNode } from "@/lib/dfd/graph";

export const NODE_ICON = { external: "code", process: "layers", store: "database" } as const;

// As regras do mockup e do React Flow não estão em @layer, por isso os utilitários que as contrariam levam "!".
const PORT =
  "size-2.5! rounded-full! border-2! border-[#a791ed]! bg-[#21232d]! [.theme-light_&]:border-[#8564d4]! [.theme-light_&]:bg-white!";

/** Nó do diagrama: o aspeto vem das classes .diagram-node do mockup, o comportamento (arrastar, ligar) do React Flow. */
export const DfdNode = memo(function DfdNode({ data, selected }: NodeProps<DfdFlowNode>) {
  return (
    <div
      className={`diagram-node ${data.kind} ${selected ? "selected" : ""} relative! w-[170px]!`}
      title={`${data.title} (${data.code})`}
    >
      <span className={`diagram-node-icon ${data.kind}`}><Icon name={NODE_ICON[data.kind]} size={22} /></span>
      <strong>{data.title}</strong>
      <small>{data.subtitle}</small>
      {data.findingIds.length > 0 && (
        <span className="node-warning" title={`${data.findingIds.length} active finding(s)`}><Icon name="warning" size={14} /></span>
      )}
      <Handle id="l" type="target" position={Position.Left} className={PORT} />
      <Handle id="t" type="target" position={Position.Top} className={PORT} />
      <Handle id="r" type="source" position={Position.Right} className={PORT} />
      <Handle id="b" type="source" position={Position.Bottom} className={PORT} />
    </div>
  );
});
