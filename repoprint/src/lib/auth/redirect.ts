const DEFAULT_AFTER_LOGIN = "/repositories";

/**
 * Decide para onde ir depois do login a partir do parâmetro ?next=.
 * Só aceita caminhos do próprio site (evita "open redirect": /login?next=https://site-falso.com).
 */
export function resolveNextPath(next: string | null, origin: string): string {
  if (!next) return DEFAULT_AFTER_LOGIN;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return DEFAULT_AFTER_LOGIN;          // "//evil.com", "https://...", "javascript:..."
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/signup")) return DEFAULT_AFTER_LOGIN; // evita voltar às páginas de acesso
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
}

/** Destino depois do login/registo, lido do ?next= do URL atual. Só no cliente (no momento do submit). */
export function nextPathFromLocation(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return resolveNextPath(next, window.location.origin);
}
