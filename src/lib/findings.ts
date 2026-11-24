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
  const claimed = new Set<string>();

  const risks: NodeRisk[] = model.nodes.map((node) => {
    const matched: Finding[] = [];
    const nodeIdLower = node.id.toLowerCase();
    const nodeTitleLower = node.title.toLowerCase();

    for (const f of findings) {
      if (node.findingIds.includes(f.id)) {
        matched.push(f);
        claimed.add(f.id);
        continue;
      }
      const compLower = (f.component || "").toLowerCase();
      if (compLower && (compLower === nodeIdLower || compLower === nodeTitleLower)) {
        matched.push(f);
        claimed.add(f.id);
        continue;
      }
      const locLower = (f.location || "").toLowerCase();
      if (locLower && (locLower === nodeIdLower || locLower === nodeTitleLower)) {
        matched.push(f);
        claimed.add(f.id);
        continue;
      }
    }

    const list = prioritize(matched);
    return { node, findings: list, severity: list[0]?.severity ?? null };
  });

  const unclaimed = findings.filter((f) => !claimed.has(f.id));
  if (unclaimed.length > 0) {
    const groups = new Map<string, Finding[]>();
    for (const f of unclaimed) {
      const key = f.component || f.file || "General";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    }

    for (const [key, group] of groups.entries()) {
      const list = prioritize(group);
      const isStore =
        key.toLowerCase().includes("db") ||
        key.toLowerCase().includes("data") ||
        key.toLowerCase().includes("store") ||
        key.toLowerCase().includes("log");
      const syntheticNode: DfdNodeData = {
        id: `synth-${key.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`,
        title: key,
        subtitle: isStore ? "DATA STORE" : "PROCESS",
        kind: isStore ? "store" : "process",
        x: 0,
        y: 0,
        code: "C-" + key.slice(0, 6).toUpperCase(),
        classification: "Analyzed component",
        findingIds: list.map((f) => f.id),
      };
      risks.push({ node: syntheticNode, findings: list, severity: list[0]?.severity ?? null });
    }
  }

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
