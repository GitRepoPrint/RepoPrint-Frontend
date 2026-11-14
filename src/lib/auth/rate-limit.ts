const hits= new Map<string, number[]>();

export function allow(key: string, limit: number, windowMs: number, now: number= Date.now()): boolean {
  const recent= (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function resetRateLimits() {
  hits.clear();
}
