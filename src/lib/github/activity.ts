import { ApiError } from "@/lib/api/errors";
import { formatClock } from "@/lib/format";

const API= "https://api.github.com";
const PAGE_SIZE= 100;
const DAY_MS= 24 * 60 * 60 * 1000;
const HOUR_MS= 60 * 60 * 1000;
const LAST_PAGE= /<([^>]+)>;\s*rel="last"/;
const NEXT_PAGE= /<([^>]+)>;\s*rel="next"/;

export const MAX_COMMIT_PAGES= 5;

export type Fetcher= (input: string, init?: RequestInit) => Promise<Response>;

export interface GithubActivity {
  owner: string;
  repo: string;
  defaultBranch: string;
  totalCommits: number;
  commitsLast30d: number;
  commitsLast90d: number;
  commitsPerWeek90d: number;
  activeContributors: number;
  botsExcluded: number;
  contributorsWindow: { complete: boolean; commitsRead: number; since: string };
  medianPrMergeHours: number | null;
  mergedPrsSampled: number;
  openPrs: number;
  openIssues: number;
  stars: number;
}

interface Commit {
  author: { login: string; type: string } | null;
  commit: { author: { email: string }; committer: { date: string } };
}

interface Pull {
  created_at: string;
  merged_at: string | null;
}

interface RepoInfo {
  default_branch: string;
  open_issues_count: number;
  stargazers_count: number;
}

type Params= Record<string, string | number>;

const browserFetch: Fetcher= (input, init) => fetch(input, init);

const round1= (value: number) => Math.round(value * 10) / 10;

const isoSeconds= (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

function rateLimitMessage(response: Response): string {
  const retryAfter= Number(response.headers.get("retry-after"));
  const reset= Number(response.headers.get("x-ratelimit-reset"));
  const when= retryAfter > 0 ? Date.now() + retryAfter * 1000 : reset > 0 ? reset * 1000 : null;
  const suffix= when === null ? "Try again in a few minutes." : `Try again at ${formatClock(new Date(when).toISOString())}.`;
  return `GitHub rate limit reached for your network. ${suffix}`;
}

function errorFor(response: Response): ApiError {
  if (response.status=== 404) return new ApiError("Repository not found. It may not exist or may be private.", 404);
  if (response.status=== 409) return new ApiError("This repository is empty.", 422);
  const limited= response.headers.get("x-ratelimit-remaining")=== "0" || response.headers.has("retry-after");
  if ((response.status=== 403 || response.status=== 429) && limited) return new ApiError(rateLimitMessage(response), 429);
  return new ApiError("GitHub did not respond. Please try again.", 502);
}

async function get(fetcher: Fetcher, target: string, params: Params= {}): Promise<Response> {
  const url= new URL(target.startsWith("http") ? target : `${API}${target}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response= await fetcher(url.toString(), { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw errorFor(response);
  return response;
}

function link(header: string | null, pattern: RegExp): string | null {
  return header?.match(pattern)?.[1] ?? null;
}

async function count(fetcher: Fetcher, path: string, params: Params= {}): Promise<number> {
  const response= await get(fetcher, path, { per_page: 1, ...params });
  const last= link(response.headers.get("link"), LAST_PAGE);
  if (last) return Number(new URL(last).searchParams.get("page"));
  return ((await response.json()) as unknown[]).length;
}

async function paginate<T>(fetcher: Fetcher, path: string, maxPages: number, params: Params= {}): Promise<T[]> {
  const items: T[]= [];
  let target= path;
  let query: Params= { per_page: PAGE_SIZE, ...params };
  for (let page= 0; page < maxPages; page++) {
    const response= await get(fetcher, target, query);
    items.push(...((await response.json()) as T[]));
    const next= link(response.headers.get("link"), NEXT_PAGE);
    if (!next) break;
    target= next;
    query= {};
  }
  return items;
}

async function orNull<T>(call: Promise<T>): Promise<T | null> {
  try {
    return await call;
  } catch (error) {
    if (error instanceof ApiError && error.status=== 404) return null;
    throw error;
  }
}

function median(values: number[]): number | null {
  if (values.length=== 0) return null;
  const sorted= [...values].sort((a, b) => a - b);
  const middle= Math.floor(sorted.length / 2);
  return round1(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

const authorOf= (commit: Commit) => commit.author?.login || commit.commit.author.email;

const isBot= (commit: Commit) => commit.author?.type=== "Bot";

export async function fetchGithubActivity(
  owner: string,
  repo: string,
  options: { fetcher?: Fetcher; now?: Date }= {},
): Promise<GithubActivity> {
  const fetcher= options.fetcher ?? browserFetch;
  const now= options.now ?? new Date();
  const since30= isoSeconds(new Date(now.getTime() - 30 * DAY_MS));
  const since90= isoSeconds(new Date(now.getTime() - 90 * DAY_MS));
  const base= `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const [infoResponse, totalCommits]= await Promise.all([get(fetcher, base), count(fetcher, `${base}/commits`)]);

  const [commits30d, commits90d, openPrs, sample, closedPrs]= await Promise.all([
    count(fetcher, `${base}/commits`, { since: since30 }),
    count(fetcher, `${base}/commits`, { since: since90 }),
    orNull(count(fetcher, `${base}/pulls`, { state: "open" })),
    paginate<Commit>(fetcher, `${base}/commits`, MAX_COMMIT_PAGES, { since: since90 }),
    orNull(paginate<Pull>(fetcher, `${base}/pulls`, 1, { state: "closed", sort: "updated", direction: "desc" })),
  ]);

  const info= (await infoResponse.json()) as RepoInfo;
  const open= openPrs ?? 0;
  const mergeHours= (closedPrs ?? []).flatMap((pull) =>
    pull.merged_at ? [(Date.parse(pull.merged_at) - Date.parse(pull.created_at)) / HOUR_MS] : [],
  );
  const people= new Set(sample.filter((commit) => !isBot(commit)).map(authorOf));
  const bots= new Set(sample.filter(isBot).map(authorOf));
  const truncated= sample.length >= MAX_COMMIT_PAGES * PAGE_SIZE;
  const since= truncated
    ? new Date(Math.min(...sample.map((commit) => Date.parse(commit.commit.committer.date)))).toISOString()
    : since90;

  return {
    owner,
    repo,
    defaultBranch: info.default_branch,
    totalCommits,
    commitsLast30d: commits30d,
    commitsLast90d: commits90d,
    commitsPerWeek90d: round1(commits90d / (90 / 7)),
    activeContributors: people.size,
    botsExcluded: bots.size,
    contributorsWindow: { complete: !truncated, commitsRead: sample.length, since },
    medianPrMergeHours: median(mergeHours),
    mergedPrsSampled: mergeHours.length,
    openPrs: open,
    openIssues: Math.max(info.open_issues_count - open, 0),
    stars: info.stargazers_count,
  };
}
