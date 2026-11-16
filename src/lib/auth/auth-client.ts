export type AuthOutcome= { ok: true; next: string } | { ok: false; error: string };

export async function postAuth(path: "/api/auth/login" | "/api/auth/signup", payload: Record<string, string>): Promise<AuthOutcome> {
  try {
    const response= await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data= (await response.json().catch(() => ({}))) as { next?: unknown; error?: unknown };
    if (response.ok && typeof data.next === "string") return { ok: true, next: data.next };
    return { ok: false, error: typeof data.error === "string" ? data.error : "unavailable" };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
