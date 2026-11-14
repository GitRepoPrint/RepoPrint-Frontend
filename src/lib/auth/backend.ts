export function backendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:8000";
}

export function backendFetch(path: string, accessToken: string, init: RequestInit= {}): Promise<Response> {
  const headers= new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`${backendUrl()}${path}`, { ...init, headers, cache: "no-store" });
}
