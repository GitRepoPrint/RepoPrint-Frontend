import { demoRepositories } from "./mock/repositories";
import type { Repository } from "./types";

const STORAGE_KEY = "repoprint-repositories"; // mesma chave do mockup

// Aceita "https://github.com/org/repo", "github.com/org/repo", ".git" no fim e links para páginas
// dentro do repositório ("/tree/main", "?tab=readme"...). Usado na análise instantânea e no modal "Associate repository".
const GITHUB_REPO = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i;

/** "https://github.com/org/repo/tree/main" -> "org/repo"; null se não for um URL GitHub válido. */
export function parseGithubRepository(input: string): string | null {
  const match = input.trim().match(GITHUB_REPO);
  if (!match) return null;
  const [, owner, repo] = match;
  // O slug usa "--" como separador (ver repoSlug): os donos do GitHub nunca o contêm, por isso recusa-se aqui.
  if (owner.includes("--") || [owner, repo].some((part) => part === "." || part === "..")) return null;
  return `${owner}/${repo}`;
}

/** "org/repo" -> "org--repo": um único segmento de URL, compatível com a pasta [repoId]. */
export function repoSlug(name: string): string {
  return name.replace("/", "--");
}

/** "org--repo" -> "org/repo" (parte no primeiro "--"); null se não tiver o formato certo. */
export function repoFromSlug(slug: string): string | null {
  const index = slug.indexOf("--");
  if (index <= 0 || index + 2 >= slug.length) return null;
  const name = `${slug.slice(0, index)}/${slug.slice(index + 2)}`;
  // Só aceita nomes que o modal também aceitaria (evita /repositories/<lixo> chegar ao dashboard).
  return /^[\w.-]+\/[\w.-]+$/.test(name) && !name.split("/").some((part) => part === "." || part === "..") ? name : null;
}

function isRepository(value: unknown): value is Repository {
  const v = value as Partial<Repository> | null;
  return (
    typeof v === "object" && v !== null &&
    typeof v.name === "string" && typeof v.description === "string" &&
    typeof v.language === "string" && typeof v.updated === "string" &&
    (v.score === null || typeof v.score === "number") &&
    (v.analyzedAt === undefined || typeof v.analyzedAt === "string")
  );
}

/** Lê do localStorage (só no cliente); se não houver nada válido, devolve os repositórios de demonstração. */
export function loadRepositories(): Repository[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(saved) && saved.every(isRepository) ? saved : demoRepositories;
  } catch {
    return demoRepositories;
  }
}

export function saveRepositories(repositories: Repository[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repositories));
  } catch {
    /* storage cheio ou indisponível: a lista só dura até recarregar */
  }
}

/** Os repositórios de demonstração não existem no GitHub: o diagrama deles é o mock, não se tenta inferir. */
export const isDemoRepository = (name: string) => demoRepositories.some((repository) => repository.name.toLowerCase() === name.toLowerCase());

export const PENDING_DESCRIPTION = "Newly associated repository · analysis pending";
export const ANALYZED_DESCRIPTION = "Architecture inferred from the repository's configuration";

export function newRepository(name: string): Repository {
  return { name, description: PENDING_DESCRIPTION, language: "—", score: null, updated: "Just added" };
}

/** Em que ponto está um repositório: com pontuação (os de demonstração), analisado mas sem pontuação, ou à espera da análise. */
export type RepositoryStage = "scored" | "analyzed" | "pending";

export const stageOf = (repository: Repository): RepositoryStage =>
  repository.score !== null ? "scored" : repository.analyzedAt ? "analyzed" : "pending";

/** "Just now", "5 min ago", "2 hours ago", "3 days ago"; mais de um mês, a data. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(then).toLocaleDateString("en-GB");
}
