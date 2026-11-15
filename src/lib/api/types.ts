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

export interface InstantSummary {
  stride: { findings: number; high: number; medium: number; detail: string } | null;
  privacy: { highRisks: number; labels: string; detail: string } | null;
  git: { prMergeHours: number | null; commitsPerMonth: number; codeOwnersCoverage: number | null };
}

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
  source: AnalysisSource;
  repository: string;        // "org/repo"
  commit: string | null;
  branch: string;
  analyzedAt: string;        // ISO 8601
  summary: InstantSummary;
  findings: Finding[];
  activity?: ActivityInfo;
}

// ---------- Repositórios ----------

export interface Repository {
  name: string;              // "org/repo"
  description: string;
  language: string;
  score: number | null;      // null = análise pendente
  updated: string;           // texto livre no mock ("2 hours ago")
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
  boundary: { x: number; y: number; width: number; height: number; label: string };
  nodes: DfdNodeData[];
  flows: string[];           // atributo "d" de cada ligação (pré-visualização do dashboard)
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
