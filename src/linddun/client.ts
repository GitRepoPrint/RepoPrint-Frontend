import { getApiBaseUrl } from "@/lib/config";
import type {
  LinddunCatalog,
  LinddunCategory,
  LinddunFinding,
  LinddunReport,
  LinddunSeverity,
  LinddunSummary,
} from "./types";
import { LINDDUN_CATEGORIES, LINDDUN_SEVERITIES } from "./types";
import localCatalog from "./catalog.json";

export const LINDDUN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

export class LinddunApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?:
      | "INVALID_URL"
      | "RATE_LIMIT"
      | "SERVICE_BUSY"
      | "NOT_FOUND"
      | "NETWORK_ERROR"
      | "SERVER_ERROR"
  ) {
    super(message);
    this.name = "LinddunApiError";
  }
}

interface CacheEntry {
  fetchedAt: number;
  report: LinddunReport;
}

const memory = new Map<string, CacheEntry>();

export function normalizeRepoUrl(repository: string): string {
  const trimmed = repository.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://github.com/${trimmed}`;
}

export function cacheKeyFor(repository: string, groupBy: "directory" | "file" = "directory"): string {
  return `${repository.toLowerCase()}::${groupBy}`;
}

export function peekLinddun(
  repository: string,
  groupBy: "directory" | "file" = "directory",
  now = Date.now()
): LinddunReport | null {
  const key = cacheKeyFor(repository, groupBy);
  const entry = memory.get(key);
  if (!entry) return null;
  if (now - entry.fetchedAt >= LINDDUN_CACHE_TTL_MS) {
    memory.delete(key);
    return null;
  }
  return entry.report;
}

export function setLinddunCache(
  repository: string,
  report: LinddunReport,
  groupBy: "directory" | "file" = "directory",
  now = Date.now()
) {
  memory.set(cacheKeyFor(repository, groupBy), { fetchedAt: now, report });
}

export function clearLinddunCache(repository?: string) {
  if (repository) {
    const prefix = repository.toLowerCase();
    for (const key of memory.keys()) {
      if (key.startsWith(prefix)) {
        memory.delete(key);
      }
    }
  } else {
    memory.clear();
  }
}

export function createEmptySummary(): LinddunSummary {
  const by_category = Object.fromEntries(
    LINDDUN_CATEGORIES.map((cat) => [cat, 0])
  ) as Record<LinddunCategory, number>;

  const by_severity = Object.fromEntries(
    LINDDUN_SEVERITIES.map((sev) => [sev, 0])
  ) as Record<LinddunSeverity, number>;

  return {
    total_findings: 0,
    by_category,
    by_severity,
  };
}

const CATEGORY_MAP: Record<string, LinddunCategory> = {
  linkability: "Linkability",
  identifiability: "Identifiability",
  "non-repudiation": "Non-repudiation",
  non_repudiation: "Non-repudiation",
  "non repudiation": "Non-repudiation",
  detectability: "Detectability",
  "disclosure of information": "Disclosure of information",
  disclosure_of_information: "Disclosure of information",
  unawareness: "Unawareness",
  "non-compliance": "Non-compliance",
  non_compliance: "Non-compliance",
  "non compliance": "Non-compliance",
};

export function normalizeCategory(val: unknown): LinddunCategory {
  if (typeof val !== "string") return "Disclosure of information";
  const normalized = val.trim().toLowerCase();
  if (CATEGORY_MAP[normalized]) {
    return CATEGORY_MAP[normalized];
  }
  const match = LINDDUN_CATEGORIES.find(
    (c) => c.toLowerCase() === normalized
  );
  return match || "Disclosure of information";
}

export function normalizeSeverity(val: unknown): LinddunSeverity {
  const str = String(val || "").trim().toLowerCase();
  if (str === "critical") return "Critical";
  if (str === "high") return "High";
  if (str === "medium") return "Medium";
  if (str === "low") return "Low";
  if (str === "info") return "Info";
  return "Medium";
}

export function normalizeReport(raw: unknown, repository: string): LinddunReport {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid LINDDUN report format");
  }

  const data = raw as Record<string, unknown>;
  const rawFindings = Array.isArray(data.findings) ? data.findings : [];

  const findings: LinddunFinding[] = rawFindings.map((item, index) => {
    const f = item as Record<string, unknown>;
    const category = normalizeCategory(f.category);
    const severity = normalizeSeverity(f.severity);
    const targetType = typeof f.target_type === "string" ? f.target_type : "process";

    return {
      threat_id: String(f.threat_id || f.id || `T-${index + 1}`),
      category,
      severity,
      target_type: targetType,
      component_id: String(f.component_id || ""),
      component_name: typeof f.component_name === "string" ? f.component_name : null,
      title: String(f.title || "Privacy Finding"),
      description: String(f.description || ""),
      gdpr_articles: Array.isArray(f.gdpr_articles) ? (f.gdpr_articles as string[]) : [],
      mitigation: String(f.mitigation || "Review architecture and implement privacy safeguards."),
      source: typeof f.source === "string" ? f.source : null,
      target: typeof f.target === "string" ? f.target : null,
      file_path: typeof f.file_path === "string" ? f.file_path : null,
    };
  });

  const summary = createEmptySummary();
  const rawSummary = data.summary as Record<string, unknown> | undefined;

  if (rawSummary && typeof rawSummary === "object") {
    summary.total_findings = typeof rawSummary.total_findings === "number"
      ? rawSummary.total_findings
      : findings.length;

    if (rawSummary.by_category && typeof rawSummary.by_category === "object") {
      const byCat = rawSummary.by_category as Record<string, number>;
      for (const [key, value] of Object.entries(byCat)) {
        const cat = normalizeCategory(key);
        summary.by_category[cat] = (summary.by_category[cat] || 0) + Number(value || 0);
      }
    }

    if (rawSummary.by_severity && typeof rawSummary.by_severity === "object") {
      const bySev = rawSummary.by_severity as Record<string, number>;
      for (const [key, value] of Object.entries(bySev)) {
        const sev = normalizeSeverity(key);
        summary.by_severity[sev] = (summary.by_severity[sev] || 0) + Number(value || 0);
      }
    }
  } else {
    summary.total_findings = findings.length;
    for (const f of findings) {
      if (summary.by_category[f.category] !== undefined) {
        summary.by_category[f.category] += 1;
      }
      if (summary.by_severity[f.severity] !== undefined) {
        summary.by_severity[f.severity] += 1;
      }
    }
  }

  return {
    repository: String(data.repository || repository),
    analyzed_at: String(data.analyzed_at || new Date().toISOString()),
    summary,
    findings,
  };
}

export async function fetchLinddunAnalysis(
  repository: string,
  options?: {
    groupBy?: "directory" | "file";
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    forceFresh?: boolean;
  }
): Promise<LinddunReport> {
  const groupBy = options?.groupBy ?? "directory";
  if (!options?.forceFresh) {
    const cached = peekLinddun(repository, groupBy);
    if (cached) return cached;
  }

  const base = getApiBaseUrl();
  const repoUrl = normalizeRepoUrl(repository);
  const query = new URLSearchParams({ url: repoUrl, group_by: groupBy });
  const fetcher = options?.fetcher ?? fetch;

  const url = `${base}/linddun?${query}`;
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: options?.signal,
      cache: "no-store",
    });
  } catch (err: unknown) {
    if (err instanceof LinddunApiError) throw err;
    if ((err as Error)?.name === "AbortError") throw err;
    throw new LinddunApiError(
      `Não foi possível ligar ao servidor RepoPrint em ${base}. Verifica se o backend está a correr.`,
      0,
      "NETWORK_ERROR"
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.detail || errBody?.message || errBody?.error || "";
    } catch {
      detail = await response.text().catch(() => "");
    }

    if (response.status === 400) {
      throw new LinddunApiError(
        detail || "URL de repositório inválido ou parâmetros em falta. Verifica o endereço do repositório.",
        400,
        "INVALID_URL"
      );
    }
    if (response.status === 429) {
      throw new LinddunApiError(
        detail || "Limite de pedidos atingido (rate limit). Aguarda alguns momentos antes de tentar novamente.",
        429,
        "RATE_LIMIT"
      );
    }
    if (response.status === 503) {
      throw new LinddunApiError(
        detail || "O motor de privacidade LINDDUN está ocupado ou temporariamente indisponível. Tenta em breve.",
        503,
        "SERVICE_BUSY"
      );
    }
    if (response.status === 404) {
      throw new LinddunApiError(
        detail || "Repositório não encontrado ou código não acessível para análise.",
        404,
        "NOT_FOUND"
      );
    }
    throw new LinddunApiError(
      detail || `Erro no servidor (${response.status}) ao processar a análise LINDDUN.`,
      response.status,
      "SERVER_ERROR"
    );
  }

  const raw = await response.json();
  const report = normalizeReport(raw, repository);
  setLinddunCache(repository, report, groupBy);
  return report;
}

export async function fetchLinddunCatalog(options?: {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<LinddunCatalog> {
  const base = getApiBaseUrl();
  const fetcher = options?.fetcher ?? fetch;
  const url = `${base}/linddun/catalog`;

  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: options?.signal,
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as LinddunCatalog;
      if (data && typeof data === "object" && data.categories) {
        return data;
      }
    }
  } catch {
    // Silently fall back to bundled catalog
  }

  return localCatalog as unknown as LinddunCatalog;
}
