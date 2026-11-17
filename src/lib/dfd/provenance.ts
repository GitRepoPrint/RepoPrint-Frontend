// Juntar a proveniência de duas provas da mesma coisa: ganha a maior confiança, as evidências somam-se.
import type { Confidence, Evidence, Provenance } from "./schema";

export const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
export const MAX_EVIDENCE = 6;

/**
 * `a` e `b` falam do mesmo nó ou da mesma ligação. A origem (config, code) é a da prova mais forte, e a de `a` quando
 * empatam; as evidências de `a` vêm primeiro, sem repetidas, até ao máximo.
 */
export function mergeProvenance(a: Provenance, b: Provenance, cap = MAX_EVIDENCE): Provenance {
  const seen = new Set<string>();
  const evidence: Evidence[] = [];
  for (const item of [...a.evidence, ...b.evidence]) {
    const key = JSON.stringify(item);
    if (!seen.has(key) && evidence.length < cap) {
      seen.add(key);
      evidence.push(item);
    }
  }
  const stronger = RANK[b.confidence] > RANK[a.confidence] ? b : a;
  return { source: stronger.source, confidence: stronger.confidence, evidence };
}
