import { ApiError } from "@/lib/api/errors";
import type { DfdModel, DfdNodeData, Finding, Framework, Severity } from "@/lib/api/types";
import { BACKEND_URL } from "@/lib/config";
import type { DfdGraph } from "@/lib/dfd/schema";
import type { Fetcher } from "@/lib/github/activity";

export type StrideSeverity = "Critical" | "High" | "Medium" | "Low";
export type StrideCategory =
  | "Spoofing"
  | "Tampering"
  | "Repudiation"
  | "Information Disclosure"
  | "Denial of Service"
  | "Elevation of Privilege";
export type TargetType = "process" | "data_store" | "data_flow" | "external_entity";
export type FindingType = "vulnerability" | "architectural_hardening";
export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface StrideFinding {
  threat_id: string;
  category: StrideCategory | string;
  stride_letter?: string;
  severity: StrideSeverity | string;
  target_type: TargetType | string;
  finding_type?: FindingType | string;
  confidence?: ConfidenceLevel | string;
  component_id?: string | null;
  component_name?: string | null;
  title: string;
  description: string;
  mitigation?: string;
  references?: string[];
  source?: string | null;
  target?: string | null;
  protocol?: string | null;
  file_path?: string | null;
}

export interface StrideReport {
  repository: string;
  total_findings: number;
  actionable_vulnerabilities_count: number;
  architectural_recommendations_count: number;
  summary_by_category: Record<string, number>;
  summary_by_severity: Record<string, number>;
  summary_by_type: Record<string, number>;
  summary_by_confidence: Record<string, number>;
  stride_matrix: Record<string, string[]>;
  findings: StrideFinding[];
  actionable_vulnerabilities: StrideFinding[];
  architectural_recommendations: StrideFinding[];
}

export function mapSeverity(severity: string): Severity {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "high") return "high";
  if (s === "low") return "low";
  return "medium";
}

export function mapConfidence(confidence?: string): Severity {
  const c = (confidence ?? "High").toLowerCase();
  if (c === "high") return "high";
  if (c === "low") return "low";
  return "medium";
}

export function mapEffort(findingType?: string, severity?: string): { level: Severity; estimate: string } {
  if (severity?.toLowerCase() === "low") return { level: "low", estimate: "~4 hours" };
  if (findingType === "architectural_hardening") return { level: "high", estimate: "1-2 weeks" };
  return { level: "medium", estimate: "1-2 days" };
}

export function strideFindingToFinding(f: StrideFinding, index = 0): Finding {
  const sev = mapSeverity(f.severity);
  const prob = mapConfidence(f.confidence);
  const letter = f.stride_letter || (f.threat_id.split("-")[1] ?? "S");
  const shortNum = f.threat_id.split("-").pop() ?? String(index + 1).padStart(3, "0");
  const ref = `${letter}-${shortNum}`;
  const comp = f.component_name || f.component_id || "System";
  const file = f.file_path || (f.component_id?.startsWith("process:") ? f.component_id.replace("process:", "") : comp);
  const location = f.source && f.target ? `${f.source} → ${f.target}` : f.target_type;

  return {
    id: `${f.threat_id}-${f.component_id ?? index}`,
    framework: "STRIDE" as Framework,
    category: f.category,
    severity: sev,
    component: comp,
    file,
    location,
    title: f.title,
    impact: f.description.length > 80 ? `${f.description.slice(0, 77)}...` : f.description,
    impactDetail: f.description,
    exposure: {
      impact: sev,
      impactLabel: f.category.toLowerCase(),
      probability: prob,
    },
    effort: mapEffort(f.finding_type, f.severity),
    topic: f.category,
    mitigation: f.mitigation || "Implement defensive controls according to OWASP guidelines.",
    regulatoryTags: f.references && f.references.length > 0 ? f.references : ["OWASP Top 10", "STRIDE"],
    ref,
  };
}

export function strideReportToFindings(report: StrideReport): Finding[] {
  return (report.findings ?? []).map((f, i) => strideFindingToFinding(f, i));
}

export function enrichModelWithFindings(model: DfdModel, findings: Finding[]): DfdModel {
  if (!findings || findings.length === 0) return model;

  const findingIdsByNode = new Map<string, Set<string>>();
  for (const node of model.nodes) {
    findingIdsByNode.set(node.id, new Set(node.findingIds ?? []));
  }

  for (const f of findings) {
    let attached = false;
    const compLower = f.component.toLowerCase();

    for (const node of model.nodes) {
      const idLower = node.id.toLowerCase();
      const titleLower = node.title.toLowerCase();

      if (
        idLower === compLower ||
        titleLower === compLower ||
        idLower.endsWith(`:${compLower}`) ||
        idLower.includes(compLower)
      ) {
        findingIdsByNode.get(node.id)?.add(f.id);
        attached = true;
      }
    }

    if (!attached && model.nodes.length > 0) {
      const fallback = model.nodes.find((n) => n.kind === "process") ?? model.nodes[0];
      findingIdsByNode.get(fallback.id)?.add(f.id);
    }
  }

  return {
    ...model,
    nodes: model.nodes.map((node) => ({
      ...node,
      findingIds: Array.from(findingIdsByNode.get(node.id) ?? []),
    })),
  };
}

export function attachFindingsToDfdModel(model: DfdModel, report: StrideReport, findings: Finding[]): DfdModel {
  const nodeMap = new Map<string, Set<string>>();
  for (const n of model.nodes) {
    nodeMap.set(n.id, new Set(n.findingIds ?? []));
  }

  for (let i = 0; i < (report.findings ?? []).length; i++) {
    const raw = report.findings[i];
    const finding = findings[i];
    if (!finding) continue;

    let attached = false;
    if (raw.component_id && nodeMap.has(raw.component_id)) {
      nodeMap.get(raw.component_id)!.add(finding.id);
      attached = true;
    }
    if (raw.source && nodeMap.has(raw.source)) {
      nodeMap.get(raw.source)!.add(finding.id);
      attached = true;
    }
    if (raw.target && nodeMap.has(raw.target)) {
      nodeMap.get(raw.target)!.add(finding.id);
      attached = true;
    }
    for (const [nodeId, set] of nodeMap.entries()) {
      if (raw.component_name && (nodeId.toLowerCase().includes(raw.component_name.toLowerCase()) || nodeId.endsWith(`:${raw.component_name}`))) {
        set.add(finding.id);
        attached = true;
      }
    }

    if (!attached && model.nodes.length > 0) {
      const fallback = model.nodes.find((n) => n.kind === "process") ?? model.nodes[0];
      nodeMap.get(fallback.id)?.add(finding.id);
    }
  }

  const updatedNodes: DfdNodeData[] = model.nodes.map((n) => ({
    ...n,
    findingIds: Array.from(nodeMap.get(n.id) ?? []),
  }));

  return {
    ...model,
    nodes: updatedNodes,
  };
}

export interface StrideOptions {
  backendUrl?: string;
  fetcher?: Fetcher;
  groupBy?: "directory" | "file";
}

export async function analyzeDfdStride(dfd: DfdGraph, options?: StrideOptions): Promise<StrideReport> {
  const base = options?.backendUrl ?? BACKEND_URL ?? "http://localhost:8000";
  const fetcher = options?.fetcher ?? fetch;

  const response = await fetcher(`${base}/stride/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(dfd),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ApiError(`STRIDE analysis failed (${response.status}): ${errorText}`, response.status);
  }

  return response.json();
}

export async function fetchRepositoryStride(repository: string, options?: StrideOptions): Promise<StrideReport> {
  const base = options?.backendUrl ?? BACKEND_URL ?? "http://localhost:8000";
  const fetcher = options?.fetcher ?? fetch;
  const url = repository.startsWith("http") ? repository : `https://github.com/${repository}`;
  const query = new URLSearchParams({
    url,
    group_by: options?.groupBy ?? "directory",
  });

  const response = await fetcher(`${base}/stride?${query}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ApiError(`STRIDE fetch failed (${response.status}): ${errorText}`, response.status);
  }

  return response.json();
}
