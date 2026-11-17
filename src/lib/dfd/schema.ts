// Tipos do grafo DFD partilhado entre o overview (browser) e o detalhe (backend GET /dfd).
// Espelham docs/dfd-schema.md (schema v1) e app/schemas/dfd.py. Se um mudar, o outro muda.

export type GraphNodeKind = "external_entity" | "process" | "data_store";
export type Confidence = "high" | "medium" | "low";
export type Source = "config" | "code" | "manual";

export interface Evidence {
  file?: string | null;
  line?: number | null;
  span?: number | null;
  note?: string | null;
}

export interface Provenance {
  source: Source;
  confidence: Confidence;
  evidence: Evidence[];
}

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  name: string;
  technology?: string | null;
  tags?: string[];
  parent?: string | null;
  path?: string | null;
  provenance: Provenance;
  extra?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  operations?: string[];
  protocol?: string | null;
  provenance: Provenance;
  extra?: Record<string, unknown>;
}

export interface DfdGraph {
  schema_version: "1";
  repository: { owner: string; repo: string; ref?: string | null };
  level: "overview" | "detail";
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: { producer: "browser-overview" | "backend-detail" | "combined"; generated_at: string; [key: string]: unknown };
  extra?: Record<string, unknown>;
}

const KINDS: readonly string[] = ["external_entity", "process", "data_store"];
const SOURCES: readonly string[] = ["config", "code", "manual"];
const CONFIDENCES: readonly string[] = ["high", "medium", "low"];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";

function isProvenance(v: unknown): v is Provenance {
  return (
    isObject(v) &&
    SOURCES.includes(v.source as string) &&
    CONFIDENCES.includes(v.confidence as string) &&
    Array.isArray(v.evidence) && v.evidence.length > 0 && v.evidence.every(isObject)
  );
}

function isNode(v: unknown): v is GraphNode {
  return isObject(v) && isString(v.id) && isString(v.name) && KINDS.includes(v.kind as string) && isProvenance(v.provenance);
}

function isEdge(v: unknown): v is GraphEdge {
  return isObject(v) && isString(v.id) && isString(v.source) && isString(v.target) && isString(v.label) && isProvenance(v.provenance);
}

/**
 * Confirma que um JSON (resposta do backend, ficheiro, localStorage) tem a forma do schema v1.
 * Só verifica o que a interface usa: campos obrigatórios, tipos de nó e proveniência. Não verifica `extra`.
 */
export function isDfdGraph(value: unknown): value is DfdGraph {
  if (!isObject(value) || value.schema_version !== "1") return false;
  if (value.level !== "overview" && value.level !== "detail") return false;
  if (!isObject(value.repository) || !isString(value.repository.owner) || !isString(value.repository.repo)) return false;
  if (!isObject(value.meta) || !isString(value.meta.producer)) return false;
  if (!Array.isArray(value.nodes) || !value.nodes.every(isNode)) return false;
  if (!Array.isArray(value.edges) || !value.edges.every(isEdge)) return false;
  const ids = new Set((value.nodes as GraphNode[]).map((n) => n.id));
  return ids.size === value.nodes.length && (value.edges as GraphEdge[]).every((e) => ids.has(e.source) && ids.has(e.target));
}
