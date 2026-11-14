/**
 * Endereço do backend de análise de código (o que devolve o DFD ao nível do código), sem barra no fim; null se não
 * estiver configurado. É a variável NEXT_PUBLIC_BACKEND_URL (por exemplo http://localhost:8000): o Next.js põe-na no
 * código no momento da compilação, por isso tem de existir ao correr `next dev` ou `next build`.
 */
export function backendUrl(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, "");
  return value ? value : null;
}

export const BACKEND_URL = backendUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
