import { demoRepositories } from "./mock/repositories";
import type { Repository } from "./types";

const STORAGE_KEY = "repoprint-repositories"; // mesma chave do mockup

// Regra do modal "Associate repository" (igual ao mockup): só https://github.com/org/repo
const REPOSITORY_URL = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i;

/** "https://github.com/org/repo" -> "org/repo"; null se o URL não for válido. */
export function parseRepositoryUrl(input: string): string | null {
  const match = input.trim().match(REPOSITORY_URL);
  if (!match) return null;
  const [, owner, repo] = match;
  // O slug usa "--" como separador (ver repoSlug): os donos do GitHub nunca o contêm, por isso recusa-se aqui.
  if (owner.includes("--") || repo === "." || repo === ".." || owner === "." || owner === "..") return null;
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
    (v.score === null || typeof v.score === "number")
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

export function newRepository(name: string): Repository {
  return { name, description: "Newly associated repository · analysis pending", language: "—", score: null, updated: "Just added" };
}
