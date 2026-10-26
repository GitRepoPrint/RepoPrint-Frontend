import type { InstantReport } from "@/lib/api/types";

// A análise instantânea é stateless no servidor. Guardamos o último resultado só no
// sessionStorage do separador (apagado ao fechá-lo) para a pré-visualização do relatório
// e para o botão "Back to analysis" conseguirem mostrá-lo outra vez.
const KEY = "repoprint:instant-report";

export function saveInstantReport(report: InstantReport) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(report));
  } catch {
    /* storage indisponível ou cheio: a pré-visualização simplesmente não terá dados */
  }
}

export function loadInstantReport(): InstantReport | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const candidate = parsed as Partial<InstantReport> | null;
    // validação mínima: protege contra dados antigos com outra forma
    if (typeof candidate?.repository !== "string" || !Array.isArray(candidate.findings) || !candidate.summary) {
      return null;
    }
    return candidate as InstantReport;
  } catch {
    return null;
  }
}
