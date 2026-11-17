// Tipos partilhados entre a análise instantânea, a lista de repositórios e o dashboard.
// São o "contrato" com o futuro backend: quando existir, as respostas da API devem ter esta forma.

export type Severity = "high" | "medium" | "low";
export type Framework = "STRIDE" | "LINDDUN";

export interface Exposure {
  impact: Severity;
  impactLabel: string;       // "unauthorized access"
  probability: Severity;
}

export interface Effort {
  level: Severity;
  estimate: string;
}

export interface Finding {
  id: string;
  framework: Framework;
  category: string;          // "Spoofing", "Linkability"
  severity: Severity;
  component: string;         // título do nó do DFD: "Auth Gateway"
  file: string;              // "auth/session.ts"
  location: string;          // "client to API"
  title: string;
  impact: string;            // frase curta (cartões da análise instantânea)
  impactDetail: string;      // frase completa (tabelas do dashboard e do relatório)
  exposure: Exposure;
  effort: Effort;
  topic: string;             // tema da mitigação: "Sessions", "Webhooks"...
  mitigation: string;        // texto estático (sem SLM)
  regulatoryTags: string[];  // "NIS 2 Art. 21", "GDPR Arts. 25, 32"...
  ref: string;               // referência curta mostrada no inspector do canvas: "S-001"
}

// ---------- Análise instantânea ----------

export interface ActivityInfo {
  fetchedAt: string;
  refreshAvailableAt: string;
  cached: boolean;
  activeContributors: number;
  botsExcluded: number;
  contributorsWindow: { complete: boolean; commitsRead: number; since: string };
  mergeSampleSize: number;
}

export interface InstantReport {
  repository: string;        // "org/repo"
  branch: string;
  analyzedAt: string;        // ISO 8601
  commitsPerMonth: number;
  prMergeHours: number | null;
  activity: ActivityInfo;
}

// ---------- Repositórios ----------

export interface Repository {
  name: string;              // "org/repo"
  description: string;
  language: string;
  score: number | null;      // null = ainda sem pontuação de segurança (a análise de ameaças ainda não existe)
  updated: string;           // texto livre no mock ("2 hours ago")
  /** Quando se inferiu a arquitetura deste repositório (ISO 8601). Sem isto, a análise ainda não foi feita. */
  analyzedAt?: string;
}

export interface SavedRepository {
  id: string;
  name: string;
  isPrivate: boolean;
  defaultBranch: string | null;
  addedAt: string;
}

// ---------- Dashboard ----------

export type DfdNodeKind = "external" | "process" | "store";

/** De onde se tirou um componente do DFD (ver docs/dfd-schema.md, proveniência). */
export interface DfdEvidence {
  file?: string;
  line?: number;
  note?: string;
}

export interface DfdNodeData {
  id: string;
  title: string;
  subtitle: string;
  kind: DfdNodeKind;
  x: number;                 // centro, em coordenadas do SVG (pré-visualização do dashboard)
  y: number;
  code: string;              // identificador mostrado no inspector: "PR-003"
  classification: string;    // "Sensitive · PII", "Internal service"...
  findingIds: string[];      // findings que afetam este componente
  // Só nos DFD reais (inferidos do repositório); o mock não os tem.
  technology?: string;       // "postgresql", "redis"...
  confidence?: "high" | "medium" | "low";
  evidence?: DfdEvidence[];
  /** Frases curtas sobre o que há por trás do componente: "12 files", "python 10, html 2", "4 HTTP routes"... */
  facts?: string[];
  /** Quantas partes tem (pastas, ficheiros) e se estão à vista: só quando se juntou a análise do código. */
  expandable?: number;
  expanded?: boolean;
}

export interface DfdEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: "r" | "b";
  targetHandle: "l" | "t";
  label: string;
}

export interface DfdModel {
  /** Só o mock a tem: num DFD inferido do repositório não se sabe onde está a fronteira de confiança. */
  boundary?: { x: number; y: number; width: number; height: number; label: string };
  /** Área do SVG; sem ela usa-se a da pré-visualização do mock (1000x320). */
  viewBox?: { width: number; height: number };
  nodes: DfdNodeData[];
  flows: string[];           // atributo "d" de cada ligação (pré-visualização do dashboard)
  /** Traços "contém" de um componente aberto para as suas partes (a tracejado, sem seta). */
  containment?: string[];
  edges: DfdEdge[];          // as mesmas ligações como grafo (canvas completo)
}

export interface Contributor {
  initials: string;
  name: string;
  role: string | null;
  commits: number;           // total no repositório
  reviewParticipation: number | null; // 0-100
  ownership: string | null;
  color: "lavender" | "peach" | "mint" | "blue";
}

export interface TeamStats {
  commits30d: number;
  commitsStatus: string | null;
  prMergeHours: number | null;
  prMergeStatus: string | null;
  codeOwnersCoverage: number | null;
  codeOwnersStatus: string | null;
  weeklyCommits: number[] | null;
  recentPrs: { number: number; hours: number }[] | null;
  punchCard: number[][] | null;
  contributors: Contributor[] | null;
  activeContributors?: string;
  contributorsNote?: string;
  timeZone?: string;
}

export interface Hygiene {
  languages: { name: string; percent: number }[] | null;
  branches: { defaultBranch: string; protected: boolean | null; rules: string[] | null; protectedBranches: string[]; total: number | null };
  quality: { coverage: number | null; ci: { provider: string; passing: boolean | null; lastRun: string } | null };
  license: { name: string | null; osiApproved: boolean | null; commercialUseCompliant: boolean | null };
}

export interface ScanSummary {
  id: string;
  label: string;
}

export type AnalysisSource= "demo" | "git";

export interface LoadFailure {
  title: string;
  message: string;
  retryable: boolean;
}

export interface RepositoryAnalysis {
  source: AnalysisSource;
  activity?: ActivityInfo;
  repository: string;
  commit: string | null;
  branches: string[];
  defaultBranch: string;
  analyzedAt: string;        // ISO 8601
  lastScanned: string;       // "2 hours ago"
  executiveSummary: string | null;
  scans: ScanSummary[];
  findings: Finding[];
  dfd: DfdModel;
  team: TeamStats;
  hygiene: Hygiene;
}
