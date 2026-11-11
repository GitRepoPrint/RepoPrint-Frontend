// Modelo do diagrama editável (canvas) e conversões entre as três representações:
//   DfdModel (dados da análise)  ->  Diagram (o que se grava)  <->  nós/ligações do React Flow.
import { MarkerType } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { DfdEdge, DfdModel, DfdNodeKind } from "@/lib/api/types";

export const NODE_WIDTH = 170;
export const NODE_HEIGHT = 104;
export const GRID = 20;
/** Limites de zoom do canvas (usados pelo React Flow e pelos botões +/- da toolbar). */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
export const EDGE_COLOR = "#8176b1";

// A pré-visualização do dashboard usa um viewBox de 1000x320; no canvas os nós têm 170px de largura,
// por isso as posições são esticadas para as ligações terem espaço para a legenda.
const SCALE_X = 1.5;
const SCALE_Y = 1.5;

export interface DiagramNode {
  id: string;
  title: string;
  subtitle: string;
  kind: DfdNodeKind;
  code: string;
  classification: string;
  findingIds: string[];
  position: { x: number; y: number };   // canto superior esquerdo
}

export interface Diagram {
  nodes: DiagramNode[];
  edges: DfdEdge[];
}

/** Dados guardados dentro de cada nó do React Flow. */
export type DfdFlowNodeData = Omit<DiagramNode, "id" | "position"> & Record<string, unknown>;
export type DfdFlowNode = Node<DfdFlowNodeData, "dfd">;
export type DfdFlowEdge = Edge<{ label: string }, "flow">;

export const KIND_LABEL: Record<DfdNodeKind, string> = {
  external: "External Entity",
  process: "Process Node",
  store: "Data Store",
};

const CODE_PREFIX: Record<DfdNodeKind, string> = { external: "EN", process: "PR", store: "DS" };
const DEFAULT_TITLE: Record<DfdNodeKind, string> = { external: "New Entity", process: "New Process", store: "New Data Store" };
const DEFAULT_CLASSIFICATION: Record<DfdNodeKind, string> = {
  external: "External entry",
  process: "Internal service",
  store: "Internal storage",
};

export const snap = (value: number) => Math.round(value / GRID) * GRID;

const titleCase = (text: string) => text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** "EXTERNAL ENTITY" -> "External Entity"; "PROCESS" -> "Process Node"; "SENSITIVE DATA" -> "Sensitive Data". */
function canvasSubtitle(kind: DfdNodeKind, subtitle: string) {
  const pretty = titleCase(subtitle);
  return pretty === "Process" ? KIND_LABEL.process : pretty;
}

/** Converte a análise no diagrama inicial (posições em coordenadas do canvas, alinhadas à grelha). */
export function diagramFromModel(model: DfdModel): Diagram {
  return {
    nodes: model.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      subtitle: canvasSubtitle(n.kind, n.subtitle),
      kind: n.kind,
      code: n.code,
      classification: n.classification,
      findingIds: [...n.findingIds],
      position: {
        x: snap(n.x * SCALE_X - NODE_WIDTH / 2),
        y: snap(n.y * SCALE_Y - NODE_HEIGHT / 2),
      },
    })),
    edges: model.edges.map((e) => ({ ...e })),
  };
}

/** Código seguinte para um tipo de nó: continua a numeração global (EN-001, EN-002, PR-003, ...). */
export function nextCode(kind: DfdNodeKind, existing: { code: string }[]) {
  const highest = existing.reduce((max, item) => Math.max(max, Number(item.code.split("-")[1]) || 0), 0);
  return `${CODE_PREFIX[kind]}-${String(highest + 1).padStart(3, "0")}`;
}

export function createNode(kind: DfdNodeKind, position: { x: number; y: number }, existing: DfdFlowNode[]): DfdFlowNode {
  return {
    id: `node-${Date.now().toString(36)}-${existing.length}`,
    type: "dfd",
    position: { x: snap(position.x), y: snap(position.y) },
    selected: true,
    data: {
      title: DEFAULT_TITLE[kind],
      subtitle: KIND_LABEL[kind],
      kind,
      code: nextCode(kind, existing.map((n) => n.data)),
      classification: DEFAULT_CLASSIFICATION[kind],
      findingIds: [],
    },
  };
}

export function toFlowEdge(edge: DfdEdge): DfdFlowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: "flow",
    data: { label: edge.label },
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 16, height: 16 },
  };
}

/** Nós do React Flow; o primeiro data store começa selecionado (como o "User DB" no mockup). */
export function toFlowNodes(diagram: Diagram): DfdFlowNode[] {
  const firstStore = diagram.nodes.find((n) => n.kind === "store")?.id;
  return diagram.nodes.map(({ id, position, ...data }) => ({
    id,
    type: "dfd",
    position,
    selected: id === firstStore,
    data,
  }));
}

export const toFlowEdges = (diagram: Diagram): DfdFlowEdge[] => diagram.edges.map(toFlowEdge);

export function toDiagram(nodes: DfdFlowNode[], edges: DfdFlowEdge[]): Diagram {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      title: n.data.title,
      subtitle: n.data.subtitle,
      kind: n.data.kind,
      code: n.data.code,
      classification: n.data.classification,
      findingIds: [...n.data.findingIds],
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: (e.sourceHandle === "b" ? "b" : "r") as DfdEdge["sourceHandle"],
      targetHandle: (e.targetHandle === "t" ? "t" : "l") as DfdEdge["targetHandle"],
      label: e.data?.label ?? "",
    })),
  };
}

/** Texto comparável: serve para saber se há alterações por guardar (ignora a seleção). */
export const serializeDiagram = (diagram: Diagram) => JSON.stringify(diagram);
