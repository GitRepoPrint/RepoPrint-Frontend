/**
 * Erro "esperado" de uma chamada à API (ex.: repositório não encontrado, limite de pedidos).
 * A mensagem é para mostrar ao utilizador; erros de outro tipo (rede, bugs) mostram uma mensagem genérica.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** Mensagem segura para mostrar na UI a partir de qualquer erro apanhado num catch. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
