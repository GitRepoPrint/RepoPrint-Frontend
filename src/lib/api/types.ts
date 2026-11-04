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
  stride: { findings: number; high: number; medium: number; detail: string };
  privacy: { highRisks: number; labels: string; detail: string };
  git: { prMergeHours: number | null; commitsPerMonth: number; codeOwnersCoverage: number };
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
  repository: string;        // "org/repo"
  commit: string;
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
  role: string;
  commits: number;           // total no repositório
  reviewParticipation: number; // 0-100
  ownership: string;
  color: "lavender" | "peach" | "mint" | "blue";
}

export interface TeamStats {
  commits30d: number;
  commitsStatus: string;
  prMergeHours: number;
  prMergeStatus: string;
  codeOwnersCoverage: number;
  codeOwnersStatus: string;
  weeklyCommits: number[];
  recentPrs: { number: number; hours: number }[];
  punchCard: number[][];
  contributors: Contributor[];
}

export interface Hygiene {
  languages: { name: string; percent: number }[];
  branches: { defaultBranch: string; protected: boolean; rules: string[]; protectedBranches: string[]; total: number };
  quality: { coverage: number; ci: { provider: string; passing: boolean; lastRun: string } };
  license: { name: string; osiApproved: boolean; commercialUseCompliant: boolean };
}

export interface ScanSummary {
  id: string;
  label: string;
}

export interface RepositoryAnalysis {
  repository: string;
  commit: string;
  branches: string[];
  defaultBranch: string;
  analyzedAt: string;        // ISO 8601
  lastScanned: string;       // "2 hours ago"
  executiveSummary: string;
  scans: ScanSummary[];
  findings: Finding[];
  dfd: DfdModel;
  team: TeamStats;
  hygiene: Hygiene;
}
