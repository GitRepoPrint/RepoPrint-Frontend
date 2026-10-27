import type { Finding, Framework, Severity } from "@/lib/api/types";

export const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export const byFramework = (findings: Finding[], framework: Framework) =>
  findings.filter((f) => f.framework === framework);

/** Mais graves primeiro; mantém a ordem original entre findings com a mesma severidade. */
export const prioritize = (findings: Finding[]) =>
  [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

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
