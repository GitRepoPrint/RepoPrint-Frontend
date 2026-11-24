export type LinddunSeverity = "Critical" | "High" | "Medium" | "Low" | "Info";

export type LinddunCategory =
  | "Linkability"
  | "Identifiability"
  | "Non-repudiation"
  | "Detectability"
  | "Disclosure of information"
  | "Unawareness"
  | "Non-compliance";

export type TargetType = "process" | "data_store" | "data_flow" | "external_entity" | "actor";

export interface LinddunRule {
  id: string;
  category: string;
  applies_to: TargetType | string;
  severity: string;
  conditions: Record<string, unknown>;
  title: string;
  description: string;
  gdpr_articles?: string[];
  mitigation?: string;
}

export type LinddunCatalogRule = LinddunRule;

export interface LinddunCatalog {
  categories: Record<string, string>;
  dfd_properties?: Record<string, string>;
  data_types?: string[];
  rules?: LinddunRule[];
}

export interface LinddunFinding {
  threat_id: string;             // ex: "I5", "DD4", "L1"
  category: LinddunCategory | string; // ex: "Identifiability"
  severity: LinddunSeverity | string; // ex: "High"
  target_type: string;           // "process", "data_store", "data_flow", etc.
  component_id: string;
  component_name?: string | null;
  title: string;                 // ex: "Identifiable dataset"
  description: string;           // Explicação detalhada da ameaça
  gdpr_articles: string[];       // ex: ["Art. 4(1)", "Art. 32"]
  mitigation: string;            // Ação corretiva recomendada
  source?: string | null;
  target?: string | null;
  file_path?: string | null;
  extra?: Record<string, unknown>;
}

export interface LinddunSummary {
  total_findings: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
}

export interface LinddunReport {
  repository: string;
  analyzed_at: string;
  summary: LinddunSummary;
  findings: LinddunFinding[];
}

export interface CanonicalElement {
  id: string;
  name: string;
  type: string;
  technology?: string;
  file_path?: string;
  properties: Record<string, unknown>;
}

export interface CanonicalFlow {
  id: string;
  name: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
  operations?: string[];
  protocol?: string;
}

export interface CanonicalDfd {
  repository: string;
  elements: CanonicalElement[];
  data_flows: CanonicalFlow[];
}

export const LINDDUN_CATEGORIES: readonly LinddunCategory[] = [
  "Linkability",
  "Identifiability",
  "Non-repudiation",
  "Detectability",
  "Disclosure of information",
  "Unawareness",
  "Non-compliance",
] as const;

export const LINDDUN_SEVERITIES: readonly LinddunSeverity[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Info",
] as const;
