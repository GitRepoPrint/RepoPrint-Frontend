import type { DfdModel, DfdNodeData } from "@/lib/api/types";

export interface FlowDescription {
  id: string;
  from: string;
  to: string;
  data: string;
  crossesBoundary: boolean;
  sentence: string;
}

const insideBoundary = (model: DfdModel, node: DfdNodeData) => {
  const { x, y, width, height } = model.boundary;
  return node.x >= x && node.x <= x + width && node.y >= y && node.y <= y + height;
};

/** Texto de cada ligação, na mesma ordem de `model.flows`. */
export function describeFlows(model: DfdModel): FlowDescription[] {
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  return model.edges.flatMap((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return [];
    const crossesBoundary = insideBoundary(model, source) !== insideBoundary(model, target);
    const sentence = `Data flow from ${source.title} to ${target.title}: ${edge.label}${crossesBoundary ? ", crosses the trust boundary" : ""}`;
    return [{ id: edge.id, from: source.title, to: target.title, data: edge.label, crossesBoundary, sentence }];
  });
}

export function nodeConnections(model: DfdModel, nodeId: string) {
  const title = (id: string) => model.nodes.find((n) => n.id === id)?.title ?? id;
  return {
    receivesFrom: model.edges.filter((e) => e.target === nodeId).map((e) => title(e.source)),
    sendsTo: model.edges.filter((e) => e.source === nodeId).map((e) => title(e.target)),
  };
}

export const componentsInsideBoundary = (model: DfdModel) => model.nodes.filter((n) => insideBoundary(model, n)).length;
