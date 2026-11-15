export type AccessResult= { ok: true } | { ok: false; message: string };

type Fetcher= (input: string, init?: RequestInit) => Promise<Response>;

const MESSAGES: Record<number, string> = {
  401: "Your session expired. Sign in again.",
  404: "Repository not found, or your GitHub account has no access to it.",
  409: "Your GitHub connection is no longer valid. Connect GitHub again from the profile menu.",
  422: "This repository is empty.",
  429: "GitHub rate limit reached. Try again in a while.",
};

const FALLBACK= "GitHub did not respond. Please try again.";

export async function verifyRepositoryAccess(repository: string, fetcher: Fetcher= fetch): Promise<AccessResult> {
  const url= `https://github.com/${repository}`;
  try {
    const response= await fetcher(`/api/backend/github/activity?url=${encodeURIComponent(url)}`);
    if (response.ok) return { ok: true };
    return { ok: false, message: MESSAGES[response.status] ?? FALLBACK };
  } catch {
    return { ok: false, message: FALLBACK };
  }
}
