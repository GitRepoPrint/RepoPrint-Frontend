import { ApiError } from "@/lib/api/errors";
import { APP_NOT_INSTALLED } from "@/lib/dfd/detail";
import { errorFor } from "@/lib/github/activity";
import type { Fetcher } from "@/lib/github/activity";
import type { OverviewBackend } from "./fetch";

const RATE_LIMITED= "The code analysis is rate-limited right now (too many requests, or GitHub's own limit). Try again in a few minutes.";
const TOO_LARGE= "This repository is too large for the code analysis.";
const BUSY= "The code analysis is busy with other repositories. Try again in a minute.";

async function failureOf(response: Response): Promise<ApiError> {
  if (response.status === 404) {
    try {
      const body= (await response.json()) as { detail?: { code?: unknown } } | null;
      if (body?.detail?.code === "app_not_installed") return new ApiError(APP_NOT_INSTALLED, 404);
    } catch {
      /* cai na mensagem por estado */
    }
  }
  if (response.status === 413) return new ApiError(TOO_LARGE, 413);
  if (response.status === 429) return new ApiError(RATE_LIMITED, 429);
  if (response.status === 503) return new ApiError(BUSY, 503);
  return errorFor(response);
}

export function backendSource(base: string, fetcher: Fetcher= (input, init) => fetch(input, init)): OverviewBackend {
  return {
    async read(owner, repo) {
      const query= new URLSearchParams({ url: `https://github.com/${owner}/${repo}` });
      const response= await fetcher(`${base}/dfd/source?${query}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw await failureOf(response);
      const body= (await response.json()) as { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean; files?: Record<string, string> };
      return { tree: body.tree, truncated: body.truncated, files: body.files ?? {} };
    },
  };
}
