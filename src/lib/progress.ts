// O avanço de uma análise que demora, como o backend o conta (GET /dfd/stream) e como o interface o mostra.
//
// O backend só diz em que fase está e quantos ficheiros já foram dessa fase. Aqui junta-se isso numa só percentagem, para a roda de
// progresso: cada fase ocupa uma fatia do total, e dentro de uma fase com contagem a fatia enche-se a pouco e pouco.

export type LoadStage = "listing" | "downloading" | "parsing" | "building";

export interface LoadProgress {
  stage: LoadStage;
  done: number;
  /** 0 quando a fase não sabe quanto falta (listar os ficheiros, montar o diagrama). */
  total: number;
}

export const STAGES: readonly LoadStage[] = ["listing", "downloading", "parsing", "building"];

export const STAGE_LABEL: Record<LoadStage, string> = {
  listing: "Listing the files",
  downloading: "Downloading the code",
  parsing: "Analysing the code",
  building: "Building the diagram",
};

// Que parte do todo é cada fase. Medido em repositórios reais (FastAPI e Linux): listar e montar são curtos, descarregar e analisar
// são o grosso. Não têm de ser exatos: só têm de crescer sempre.
const SLICE: Record<LoadStage, readonly [start: number, end: number]> = {
  listing: [0, 0.12],
  downloading: [0.12, 0.55],
  parsing: [0.55, 0.92],
  building: [0.92, 1],
};

export const isStage = (value: unknown): value is LoadStage => typeof value === "string" && (STAGES as readonly string[]).includes(value);

/** De 0 a 1. Uma fase que não sabe o total conta como o início da sua fatia; o "building" nunca chega a 1 (só o resultado acaba). */
export function overallFraction(progress: LoadProgress): number {
  const [start, end] = SLICE[progress.stage];
  if (progress.total <= 0) return start;
  const within = Math.min(Math.max(progress.done, 0), progress.total) / progress.total;
  return start + (end - start) * within;
}

/** O maior de dois valores: uma roda de progresso nunca volta para trás. */
export const rising = (previous: number | undefined, next: number): number => Math.max(previous ?? 0, next);

const NUMBER = new Intl.NumberFormat("en-US");

export function describeProgress(progress: LoadProgress): string {
  const label = STAGE_LABEL[progress.stage];
  if (progress.total <= 0) return label;
  return `${label} · ${NUMBER.format(progress.done)} of ${NUMBER.format(progress.total)} files`;
}

/** As fases, cada uma feita, a decorrer ou por fazer, para a lista de passos do painel de espera. */
export function stepStates(current: LoadStage | undefined): { label: string; state: "done" | "active" | "todo" }[] {
  const index = current ? STAGES.indexOf(current) : -1;
  return STAGES.map((stage, i) => ({ label: STAGE_LABEL[stage], state: i < index ? "done" : i === index ? "active" : "todo" }));
}
