import { fetchGithubActivity } from "./activity";
import type { Fetcher, GithubActivity } from "./activity";
import { CACHE_TTL_MS, readCache, writeCache } from "./activity-cache";
import type { KeyValueStorage } from "./activity-cache";

export interface ActivityResult {
  activity: GithubActivity;
  fetchedAt: string;
  refreshAvailableAt: string;
  cached: boolean;
}

type Options= { fetcher?: Fetcher; storage?: KeyValueStorage | null; clock?: () => number };

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window=== "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const resultOf= (activity: GithubActivity, fetchedAt: number, cached: boolean): ActivityResult => ({
  activity,
  cached,
  fetchedAt: new Date(fetchedAt).toISOString(),
  refreshAvailableAt: new Date(fetchedAt + CACHE_TTL_MS).toISOString(),
});

export async function getActivity(owner: string, repo: string, options: Options= {}): Promise<ActivityResult> {
  const storage= options.storage === undefined ? browserStorage() : options.storage;
  const now= (options.clock ?? Date.now)();

  const hit= storage ? readCache(storage, owner, repo, now) : null;
  if (hit) return resultOf(hit.activity, hit.fetchedAt, true);

  const activity= await fetchGithubActivity(owner, repo, { fetcher: options.fetcher, now: new Date(now) });
  if (storage) writeCache(storage, activity, now);
  return resultOf(activity, now, false);
}
