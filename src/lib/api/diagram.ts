import type { Diagram } from "@/lib/dfd/graph";

// Mock da persistência do diagrama: localStorage por repositório. Com backend, isto passa a ser GET/PUT.
const key = (repository: string) => `repoprint-diagram:${repository}`;

const KINDS = ["external", "process", "store"];
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === "string";

function isDiagram(value: unknown): value is Diagram {
  const v = value as Partial<Diagram> | null;
  if (typeof v !== "object" || v === null || !Array.isArray(v.nodes) || !Array.isArray(v.edges)) return false;
  const nodesOk = v.nodes.every(
    (n) =>
      typeof n === "object" && n !== null &&
      isString(n.id) && isString(n.title) && isString(n.subtitle) && isString(n.code) && isString(n.classification) &&
      KINDS.includes(n.kind) &&
      Array.isArray(n.findingIds) && n.findingIds.every(isString) &&
      typeof n.position === "object" && n.position !== null && isNumber(n.position.x) && isNumber(n.position.y),
  );
  if (!nodesOk) return false;
  const ids = new Set(v.nodes.map((n) => n.id));
  return v.edges.every(
    (e) =>
      typeof e === "object" && e !== null &&
      isString(e.id) && isString(e.label) && ids.has(e.source) && ids.has(e.target) &&
      (e.sourceHandle === "r" || e.sourceHandle === "b") && (e.targetHandle === "l" || e.targetHandle === "t"),
  );
}

/** Diagrama guardado, ou null se não existir / estiver corrompido (o canvas usa então o da análise). */
export function loadDiagram(repository: string): Diagram | null {
  try {
    const raw = window.localStorage.getItem(key(repository));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDiagram(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDiagram(repository: string, diagram: Diagram): boolean {
  try {
    window.localStorage.setItem(key(repository), JSON.stringify(diagram));
    return true;
  } catch {
    return false;
  }
}
