import { ApiError } from "./errors";
import { demoRepositories } from "./mock/repositories";
import type { SavedRepository } from "./types";

const LEGACY_STORAGE_KEY= "repoprint-repositories";

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

export const isDemoRepository= (name: string) => demoRepositories.some((repository) => repository.name.toLowerCase() === name.toLowerCase());

type Fetcher= (input: string, init?: RequestInit) => Promise<Response>;

type BackendRepository= {
  id: string;
  name: string;
  is_private: boolean;
  default_branch: string | null;
  created_at: string;
};

const SESSION_EXPIRED= "Your session expired. Sign in again.";
const GITHUB_DOWN= "GitHub did not respond. Please try again.";
const UNREACHABLE= "Could not reach RepoPrint. Check your connection and try again.";

const ASSOCIATE_MESSAGES: Record<number, string> = {
  400: "Enter a valid GitHub repository URL.",
  401: SESSION_EXPIRED,
  404: "Repository not found, or your GitHub account has no access to it.",
  429: "GitHub rate limit reached. Try again in a while.",
};

export function associateErrorMessage(status: number, detail?: string): string {
  if (status === 409) {
    return /github/i.test(detail ?? "")
      ? "Your GitHub connection is no longer valid. Connect GitHub again from the profile menu."
      : "This repository is already associated.";
  }
  return ASSOCIATE_MESSAGES[status] ?? GITHUB_DOWN;
}

export function listErrorMessage(status: number): string {
  return status === 401 ? SESSION_EXPIRED : "Could not load your repositories. Please try again.";
}

function isBackendRepository(value: unknown): value is BackendRepository {
  const v= value as Partial<BackendRepository> | null;
  return (
    typeof v === "object" && v !== null &&
    typeof v.id === "string" && typeof v.name === "string" &&
    typeof v.is_private === "boolean" &&
    (v.default_branch === null || typeof v.default_branch === "string") &&
    typeof v.created_at === "string" && !Number.isNaN(Date.parse(v.created_at))
  );
}

export function toSavedRepository(value: BackendRepository): SavedRepository {
  return { id: value.id, name: value.name, isPrivate: value.is_private, defaultBranch: value.default_branch, addedAt: value.created_at };
}

async function request(path: string, init: RequestInit | undefined, fetcher: Fetcher): Promise<Response> {
  try {
    return await fetcher(path, init);
  } catch {
    throw new ApiError(UNREACHABLE);
  }
}

async function detailOf(response: Response): Promise<string | undefined> {
  try {
    const body: unknown= await response.json();
    const detail= (body as { detail?: unknown } | null)?.detail;
    return typeof detail === "string" ? detail : undefined;
  } catch {
    return undefined;
  }
}

export async function listRepositories(fetcher: Fetcher= fetch): Promise<SavedRepository[]> {
  const response= await request("/api/backend/repositories", undefined, fetcher);
  if (!response.ok) throw new ApiError(listErrorMessage(response.status), response.status);
  const body: unknown= await response.json().catch(() => null);
  if (!Array.isArray(body) || !body.every(isBackendRepository)) throw new ApiError(listErrorMessage(500), 500);
  return body.map(toSavedRepository);
}

export async function associateRepository(name: string, fetcher: Fetcher= fetch): Promise<SavedRepository> {
  const init= { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: `https://github.com/${name}` }) };
  const response= await request("/api/backend/repositories", init, fetcher);
  if (!response.ok) throw new ApiError(associateErrorMessage(response.status, await detailOf(response)), response.status);
  const body: unknown= await response.json().catch(() => null);
  if (!isBackendRepository(body)) throw new ApiError(GITHUB_DOWN, 502);
  return toSavedRepository(body);
}

export function forgetLegacyRepositories() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    return;
  }
}

export function formatAdded(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
