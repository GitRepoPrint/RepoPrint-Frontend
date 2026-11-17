import { redirect } from "next/navigation";
import { peekSession } from "@/lib/auth/session";
import { fetchGitAnalysis } from "./git-analysis";
import { mockAnalysis } from "./mock/analysis";
import { demoRepositories } from "./mock/repositories";
import type { LoadFailure, RepositoryAnalysis } from "./types";

export type AnalysisLoad=
  | { status: "ready"; analysis: RepositoryAnalysis }
  | { status: "not-found" }
  | { status: "failed"; failure: LoadFailure };

export function isDemoRepository(repository: string): boolean {
  const wanted= repository.toLowerCase();
  return demoRepositories.some((demo) => demo.name.toLowerCase() === wanted);
}

const refreshUrl= (returnTo: string, reason?: "invalid") =>
  `/api/auth/refresh?next=${encodeURIComponent(returnTo)}${reason ? `&reason=${reason}` : ""}`;

export async function getRepositoryAnalysis(repository: string, returnTo: string): Promise<AnalysisLoad> {
  if (isDemoRepository(repository)) {
    return { status: "ready", analysis: { ...mockAnalysis, repository } };
  }

  const session= await peekSession();
  if (session.status === "anonymous") redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (session.status === "stale") redirect(refreshUrl(returnTo));

  const load= await fetchGitAnalysis(repository, session.accessToken);
  if (load.status === "unauthorized") redirect(refreshUrl(returnTo, "invalid"));
  return load;
}
