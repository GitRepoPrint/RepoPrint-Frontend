import type { GithubActivity } from "./activity";

export const CACHE_TTL_MS= 10 * 60 * 1000;

const VERSION= 1;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface Entry {
  version: number;
  fetchedAt: number;
  activity: GithubActivity;
}

const keyFor= (owner: string, repo: string) => `repoprint:activity:${owner}/${repo}`.toLowerCase();

export function readCache(storage: KeyValueStorage, owner: string, repo: string, now: number): Entry | null {
  const key= keyFor(owner, repo);
  try {
    const raw= storage.getItem(key);
    if (!raw) return null;
    const entry= JSON.parse(raw) as Partial<Entry>;
    if (entry.version !== VERSION || typeof entry.fetchedAt !== "number" || !entry.activity) return null;
    if (now - entry.fetchedAt >= CACHE_TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return entry as Entry;
  } catch {
    return null;
  }
}

export function writeCache(storage: KeyValueStorage, activity: GithubActivity, now: number): void {
  const entry: Entry= { version: VERSION, fetchedAt: now, activity };
  try {
    storage.setItem(keyFor(activity.owner, activity.repo), JSON.stringify(entry));
  } catch {
    return;
  }
}
