/**
 * Endereço do backend de análise de código e serviços de privacidade LINDDUN.
 * Suporta NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_API_URL, VITE_API_URL, REACT_APP_API_URL.
 */
export function backendUrl(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, "");
  return value ? value : null;
}

export const BACKEND_URL = backendUrl(
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.VITE_API_URL ||
  process.env.REACT_APP_API_URL
);

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.VITE_API_URL ||
    process.env.REACT_APP_API_URL ||
    "http://localhost:8000"
  ).trim().replace(/\/+$/, "");
}
