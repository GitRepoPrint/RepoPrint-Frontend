import type { Diagram, DiagramNode } from "./graph";
import { NODE_HEIGHT, NODE_WIDTH } from "./graph";

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string);

const PADDING = 60;
const HEADER = 70;

type Point = { x: number; y: number };

function handlePoint(node: DiagramNode, handle: string): Point {
  const { x, y } = node.position;
  if (handle === "r") return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT / 2 };
  if (handle === "b") return { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT };
  if (handle === "t") return { x: x + NODE_WIDTH / 2, y };
  return { x, y: y + NODE_HEIGHT / 2 };
}

const OUTWARD: Record<string, Point> = { r: { x: 1, y: 0 }, l: { x: -1, y: 0 }, b: { x: 0, y: 1 }, t: { x: 0, y: -1 } };

/** Pequeno ícone por tipo de nó, desenhado dentro do quadrado colorido (31x31) em (x, y). */
function nodeGlyph(kind: DiagramNode["kind"], x: number, y: number, ink: string) {
  const cx = x + 15.5, cy = y + 15.5;
  if (kind === "external") return `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${ink}" font-family="monospace" font-size="11" font-weight="700">&lt;/&gt;</text>`;
  if (kind === "process") return `<g fill="none" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"><path d="M${cx} ${cy - 8} ${cx + 8} ${cy - 4} ${cx} ${cy} ${cx - 8} ${cy - 4}Z"/><path d="M${cx - 8} ${cy} ${cx} ${cy + 4} ${cx + 8} ${cy}M${cx - 8} ${cy + 4} ${cx} ${cy + 8} ${cx + 8} ${cy + 4}"/></g>`;
  return `<g fill="none" stroke="${ink}" stroke-width="1.6"><ellipse cx="${cx}" cy="${cy - 6}" rx="8" ry="3"/><path d="M${cx - 8} ${cy - 6}V${cy + 6}C${cx - 8} ${cy + 9} ${cx + 8} ${cy + 9} ${cx + 8} ${cy + 6}V${cy - 6}M${cx - 8} ${cy}C${cx - 8} ${cy + 3} ${cx + 8} ${cy + 3} ${cx + 8} ${cy}"/></g>`;
}

export type ExportTheme = "dark" | "light";

// Cores iguais às do canvas em cada tema (as do tema claro vêm das regras .theme-light do mockup).
const PALETTE = {
  dark: {
    background: "#0d1117", title: "#ffffff", edge: "#8176b1",
    labelFill: "#222335", labelStroke: "#4c4566", labelText: "#9b93bd",
    nodeFill: "#20232e", nodeStroke: "#656074", nodeTitle: "#f2f0f7", nodeSubtitle: "#9499a8",
    kinds: {
      external: { fill: "#3c3b54", ink: "#c1b8ee" },
      process: { fill: "#433757", ink: "#c7a9f9" },
      store: { fill: "#384c5a", ink: "#9bc6e0" },
    },
  },
  light: {
    background: "#f6f7fc", title: "#29293b", edge: "#8176b1",
    labelFill: "#ffffff", labelStroke: "#d5caef", labelText: "#7661aa",
    nodeFill: "#ffffff", nodeStroke: "#c8c2d8", nodeTitle: "#262738", nodeSubtitle: "#717889",
    kinds: {
      external: { fill: "#e9e6f7", ink: "#5f4fae" },
      process: { fill: "#efe4fb", ink: "#7446b8" },
      store: { fill: "#dcecf5", ink: "#2f7197" },
    },
  },
} as const;

/** Gera o SVG do diagrama a partir dos dados (posições e ligações reais), no tema pedido. */
export function buildDiagramSvg(title: string, diagram: Diagram, theme: ExportTheme = "dark"): string {
  const colors = PALETTE[theme];
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const xs = diagram.nodes.map((n) => n.position.x);
  const ys = diagram.nodes.map((n) => n.position.y);
  const minX = Math.min(0, ...xs) - PADDING;
  const minY = Math.min(0, ...ys) - PADDING - HEADER;
  const maxX = Math.max(NODE_WIDTH, ...xs.map((x) => x + NODE_WIDTH)) + PADDING;
  const maxY = Math.max(NODE_HEIGHT, ...ys.map((y) => y + NODE_HEIGHT)) + PADDING;
  const width = maxX - minX;
  const height = maxY - minY;

  const edges = diagram.edges
    .map((edge) => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) return "";
      const a = handlePoint(source, edge.sourceHandle);
      const b = handlePoint(target, edge.targetHandle);
      const reach = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) / 3);
      const o1 = OUTWARD[edge.sourceHandle];
      const o2 = OUTWARD[edge.targetHandle];
      const c1 = { x: a.x + o1.x * reach, y: a.y + o1.y * reach };
      const c2 = { x: b.x + o2.x * reach, y: b.y + o2.y * reach };
      // Ponto médio de uma Bézier cúbica (t = 0.5), onde fica a legenda.
      const mid = {
        x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
        y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8,
      };
      const labelWidth = edge.label.length * 6.4 + 16;
      const label = edge.label
        ? `<rect x="${mid.x - labelWidth / 2}" y="${mid.y - 10}" width="${labelWidth}" height="20" rx="4" fill="${colors.labelFill}" stroke="${colors.labelStroke}"/><text x="${mid.x}" y="${mid.y + 4}" text-anchor="middle" fill="${colors.labelText}" font-family="monospace" font-size="10" letter-spacing="1">${escapeXml(edge.label)}</text>`
        : "";
      return `<path d="M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}" fill="none" stroke="${colors.edge}" stroke-width="2" marker-end="url(#arrow)"/>${label}`;
    })
    .join("");

  const nodes = diagram.nodes
    .map((n) => {
      const { x, y } = n.position;
      const style = colors.kinds[n.kind];
      return `<g><rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="10" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}"/><rect x="${x + 13}" y="${y + 13}" width="31" height="31" rx="6" fill="${style.fill}"/>${nodeGlyph(n.kind, x + 13, y + 13, style.ink)}<text x="${x + 13}" y="${y + 70}" fill="${colors.nodeTitle}" font-family="sans-serif" font-size="12" font-weight="700">${escapeXml(n.title)}</text><text x="${x + 13}" y="${y + 87}" fill="${colors.nodeSubtitle}" font-family="sans-serif" font-size="9">${escapeXml(n.subtitle)}</text><text x="${x + NODE_WIDTH - 13}" y="${y + 26}" text-anchor="end" fill="${style.ink}" font-family="monospace" font-size="9">${escapeXml(n.code)}</text></g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10Z" fill="${colors.edge}"/></marker></defs><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${colors.background}"/><text x="${minX + 30}" y="${minY + 42}" fill="${colors.title}" font-family="sans-serif" font-size="20">RepoPrint · ${escapeXml(title)}</text>${edges}${nodes}</svg>`;
}
