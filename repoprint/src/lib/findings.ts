import type { DfdModel, DfdNodeData, Finding, Framework, Severity } from "@/lib/api/types";

export const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
/** Da mais grave para a menos grave. */
export const SEVERITIES: Severity[] = ["high", "medium", "low"];
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Quantos findings há de cada severidade (só as que têm pelo menos um), da mais grave para a menos grave. */
export const countBySeverity = (findings: Finding[]) =>
  SEVERITIES
    .map((severity) => ({ severity, count: findings.filter((f) => f.severity === severity).length }))
    .filter(({ count }) => count > 0);

export const byFramework = (findings: Finding[], framework: Framework) =>
  findings.filter((f) => f.framework === framework);

/** Mais graves primeiro; mantém a ordem original entre findings com a mesma severidade. */
export const prioritize = (findings: Finding[]) =>
  [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

export interface NodeRisk {
  node: DfdNodeData;
  findings: Finding[];
  severity: Severity | null;
}

/** Findings de cada nó do DFD; componentes com mais risco primeiro. */
export function risksByNode(model: DfdModel, findings: Finding[]): NodeRisk[] {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const risks = model.nodes.map((node) => {
    const list = prioritize(node.findingIds.flatMap((id) => byId.get(id) ?? []));
    return { node, findings: list, severity: list[0]?.severity ?? null };
  });
  const rank = (risk: NodeRisk) => (risk.severity ? SEVERITY_ORDER[risk.severity] : 3);
  return risks.sort((a, b) => rank(a) - rank(b) || b.findings.length - a.findings.length);
}

/** "GDPR Art. 5(1)(c)" -> "Art. 5(1)(c)"; só os artigos do RGPD. */
export const gdprArticles = (finding: Finding) =>
  finding.regulatoryTags.filter((tag) => tag.startsWith("GDPR")).map((tag) => tag.replace(/^GDPR /, ""));

/** Nome curto usado no modal de falso positivo. */
export const findingLabel = (finding: Finding) => `${finding.category}: ${finding.file}`;

export const STRIDE_CATEGORIES = [
  "Spoofing",
  "Tampering",
  "Repudiation",
  "Information Disclosure",
  "Denial of Service",
  "Elevation of Privilege",
] as const;

export const LINDDUN_CATEGORIES = [
  "Linkability",
  "Identifiability",
  "Non-repudiation",
  "Detectability",
  "Disclosure of Information",
  "Unawareness",
  "Non-compliance",
] as const;

export const countByCategory = (findings: Finding[], categories: readonly string[]) =>
  categories.map((category) => ({
    category,
    count: findings.filter((f) => f.category === category).length,
  }));

export function balancedRows<T>(items: T[], max = 5): T[][] {
  const rowCount = Math.ceil(items.length / max);
  const rows: T[][] = [];
  let start = 0;
  for (let i = 0; i < rowCount; i++) {
    const size = Math.floor(items.length / rowCount) + (i < items.length % rowCount ? 1 : 0);
    rows.push(items.slice(start, start + size));
    start += size;
  }
  return rows;
}
