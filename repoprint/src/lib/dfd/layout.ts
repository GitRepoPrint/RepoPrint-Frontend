import dagre from "@dagrejs/dagre";
import type { DfdEdge } from "@/lib/api/types";
import type { Diagram, DiagramNode } from "./graph";
import { NODE_HEIGHT, NODE_WIDTH, snap } from "./graph";

/**
 * Escolhe por que lados a ligação sai e entra, conforme a posição relativa dos nós:
 * destino totalmente à direita -> direita/esquerda; destino abaixo -> baixo/cima.
 * Caso contrário (destino acima ou atrás) usa direita/esquerda, que dá a curva mais limpa.
 */
export function pickHandles(source: DiagramNode, target: DiagramNode): Pick<DfdEdge, "sourceHandle" | "targetHandle"> {
  const toTheRight = target.position.x >= source.position.x + NODE_WIDTH;
  const below = target.position.y >= source.position.y + NODE_HEIGHT;
  return !toTheRight && below ? { sourceHandle: "b", targetHandle: "t" } : { sourceHandle: "r", targetHandle: "l" };
}

/**
 * Auto-layout da esquerda para a direita com o Dagre.
 * O Dagre devolve o CENTRO de cada nó; o React Flow quer o canto superior esquerdo.
 */
export function autoLayout(diagram: Diagram): Diagram {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 150, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));

  diagram.nodes.forEach((n) => graph.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  diagram.edges.forEach((e) => graph.setEdge(e.source, e.target));

  dagre.layout(graph);

  const nodes = diagram.nodes.map((n) => {
    const { x, y } = graph.node(n.id);
    return { ...n, position: { x: snap(x - NODE_WIDTH / 2), y: snap(y - NODE_HEIGHT / 2) } };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = diagram.edges.map((e) => {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    return source && target ? { ...e, ...pickHandles(source, target) } : e;
  });
  return { ...diagram, nodes, edges };
}
