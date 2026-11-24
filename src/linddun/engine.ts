import catalogData from "./catalog.json";
import { mapDfdToLinddun } from "./mapper";
import type {
  CanonicalElement,
  CanonicalFlow,
  LinddunCatalog,
  LinddunFinding,
  LinddunReport,
  LinddunRule,
  LinddunSummary,
} from "./types";
import type { Finding, Severity } from "@/lib/api/types";

export class LinddunEngine {
  private categories: Record<string, string>;
  private dfdProperties: Record<string, string>;
  private dataTypes: string[];
  private rules: LinddunRule[];

  constructor(customCatalog?: LinddunCatalog) {
    const catalog = customCatalog || (catalogData as unknown as LinddunCatalog);
    this.categories = catalog.categories || {};
    this.dfdProperties = catalog.dfd_properties || {};
    this.dataTypes = catalog.data_types || [];
    this.rules = catalog.rules || [];
  }

  /**
   * Executa a análise de privacidade LINDDUN de forma serverless sobre um DFD
   * (canónico, Backend DfdGraph ou Frontend DfdModel).
   */
  public analyze(dfd: unknown): LinddunReport {
    const normalizedDfd = mapDfdToLinddun(dfd);

    const findings: LinddunFinding[] = [];
    const elements = normalizedDfd.elements || [];
    const dataFlows = normalizedDfd.data_flows || [];

    // 1. Avaliar regras para elementos / nós (process, data_store, actor / external_entity)
    for (const elem of elements) {
      const elemType = elem.type;
      const elemProps = elem.properties || {};

      for (const rule of this.rules) {
        const targetRuleType = rule.applies_to;

        // Permitir correspondência flexível para actor / external_entity
        if (targetRuleType !== elemType) {
          const isActorTarget = targetRuleType === "actor" || targetRuleType === "external_entity";
          const isActorElem = elemType === "actor" || elemType === "external_entity";
          if (!isActorTarget || !isActorElem) {
            continue;
          }
        }

        if (this.matchesConditions(rule.conditions || {}, elemProps)) {
          findings.push(this.createFinding(rule, elem, false));
        }
      }
    }

    // 2. Avaliar regras para fluxos de dados (data_flow)
    for (const flow of dataFlows) {
      const flowProps = flow.properties || {};

      for (const rule of this.rules) {
        if (rule.applies_to !== "data_flow") {
          continue;
        }

        if (this.matchesConditions(rule.conditions || {}, flowProps)) {
          findings.push(this.createFinding(rule, flow, true));
        }
      }
    }

    // 3. Sumário e contadores
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const f of findings) {
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    }

    const summary: LinddunSummary = {
      total_findings: findings.length,
      by_category: byCategory,
      by_severity: bySeverity,
    };

    return {
      repository: normalizedDfd.repository || "unknown",
      analyzed_at: new Date().toISOString(),
      summary,
      findings,
    };
  }

  private matchesConditions(
    conditions: Record<string, unknown>,
    properties: Record<string, unknown>
  ): boolean {
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = properties[key];

      if (Array.isArray(expectedValue)) {
        if (Array.isArray(actualValue)) {
          if (!expectedValue.some((item) => actualValue.includes(item))) {
            return false;
          }
        } else {
          if (!expectedValue.includes(actualValue)) {
            return false;
          }
        }
      } else {
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  private createFinding(
    rule: LinddunRule,
    component: CanonicalElement | CanonicalFlow,
    isFlow: boolean
  ): LinddunFinding {
    const flow = isFlow ? (component as CanonicalFlow) : undefined;
    const elem = !isFlow ? (component as CanonicalElement) : undefined;

    return {
      threat_id: rule.id,
      category: rule.category,
      severity: rule.severity,
      target_type: rule.applies_to,
      component_id: String(component.id ?? ""),
      component_name: component.name || null,
      title: rule.title,
      description: rule.description,
      gdpr_articles: rule.gdpr_articles || [],
      mitigation: rule.mitigation || "",
      source: flow?.source ? String(flow.source) : null,
      target: flow?.target ? String(flow.target) : null,
      file_path: elem?.file_path || null,
    };
  }
}

/** Instância por defeito do LinddunEngine pronta a usar */
export const defaultLinddunEngine = new LinddunEngine();

/** Função utilitária direta para correr análise LINDDUN */
export function analyzeLinddun(dfd: unknown): LinddunReport {
  return defaultLinddunEngine.analyze(dfd);
}

function normalizeCategory(category: string): string {
  if (category.toLowerCase() === "disclosure of information") {
    return "Disclosure of Information";
  }
  return category;
}

/** Converte um LinddunFinding no tipo Finding do RepoPrint */
export function toFrontendFinding(f: LinddunFinding, index: number = 0): Finding {
  const sevLower = f.severity.toLowerCase();
  const severity: Severity =
    sevLower === "critical" || sevLower === "high"
      ? "high"
      : sevLower === "medium"
        ? "medium"
        : "low";

  const category = normalizeCategory(f.category);

  const regulatoryTags = (f.gdpr_articles || []).map((art) =>
    art.startsWith("GDPR") ? art : `GDPR ${art}`
  );

  return {
    id: `linddun-${f.threat_id.toLowerCase()}-${f.component_id}-${index}`,
    ref: f.threat_id,
    framework: "LINDDUN",
    category,
    severity,
    component: f.component_name || f.component_id,
    file: f.file_path || (f.source && f.target ? `${f.source} -> ${f.target}` : "system"),
    location: f.source && f.target ? `${f.source} to ${f.target}` : f.component_name || f.target_type,
    title: f.title,
    impact: f.title,
    impactDetail: f.description,
    exposure: {
      impact: severity,
      impactLabel: f.category.toLowerCase(),
      probability: severity === "high" ? "high" : severity === "medium" ? "medium" : "low",
    },
    effort: {
      level: severity === "high" ? "medium" : "low",
      estimate: severity === "high" ? "2-3 days" : "~4 hours",
    },
    topic: f.category,
    mitigation: f.mitigation,
    regulatoryTags,
  };
}

/** Converte todo o relatório LINDDUN numa lista de Findings do RepoPrint */
export function toFrontendFindings(report: LinddunReport): Finding[] {
  return report.findings.map((finding, idx) => toFrontendFinding(finding, idx));
}
