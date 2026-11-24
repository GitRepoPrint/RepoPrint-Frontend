export type LinddunSeverity = "Critical" | "High" | "Medium" | "Low" | "Info";

export type LinddunCategory =
  | "Linkability"
  | "Linking"
  | "Identifiability"
  | "Identifying"
  | "Non-repudiation"
  | "Detectability"
  | "Detecting"
  | "Disclosure of information"
  | "Data disclosure"
  | "Unawareness"
  | "Unawareness and unintervenability"
  | "Non-compliance";

export type TargetType = "process" | "data_store" | "data_flow" | "external_entity" | "actor";

export interface LinddunRule {
  id: string;
  category: string;
  applies_to: TargetType | string;
  conditions: Record<string, unknown>;
  title: string;
  hotspot?: string;
  threat_sources?: string[];
  description: string;
  elicitation_questions?: string[];
  consequences?: string[];
  examples?: string[];
  additional_info?: string;
  severity?: string;
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
  category: LinddunCategory | string;
  target_type: string;           // "process", "data_store", "data_flow", etc.
  component_id: string;
  component_name?: string | null;
  title: string;
  hotspot?: string;
  threat_sources?: string[];
  description: string;
  elicitation_questions?: string[];
  consequences?: string[];
  examples?: string[];
  additional_info?: string;
  source?: string | null;
  target?: string | null;
  file_path?: string | null;
  extra?: Record<string, unknown>;
  severity?: string;
  gdpr_articles?: string[];
  mitigation?: string;
}

export type LinddunThreat = LinddunFinding;

export interface LinddunSummary {
  total_threats?: number;
  total_findings: number;
  by_category: Record<string, number>;
  by_threat_source?: Record<string, number>;
  by_target_type?: Record<string, number>;
  by_severity?: Record<string, number>;
}

export interface LinddunReport {
  repository: string;
  analyzed_at: string;
  summary: LinddunSummary;
  threats?: LinddunThreat[];
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
