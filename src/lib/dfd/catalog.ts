// Catálogo de tecnologias: que módulo importado significa que base de dados, serviço externo, fila ou ponto de entrada.
// Os dados são catalog.json, a mesma cópia que o backend lê (app/services/dfd_catalog.json). Se mudar um, copie para o
// outro; scripts/check-catalog-sync.sh (na raiz) compara-os. A correspondência é igual à do backend: por prefixo, sempre
// seguido de um separador (. / : \), por isso "requests" apanha "requests.adapters" mas não "requests_oauthlib".
import data from "./catalog.json";

export type CatalogCategory = "datastore" | "external" | "queue" | "entrypoint";

export interface CatalogHit {
  category: CatalogCategory;
  label: string;
  /** Slug que entra nos ids do schema: data_store:postgresql, external_entity:stripe. */
  technology: string;
}

const CATEGORIES: readonly string[] = ["datastore", "external", "queue", "entrypoint"];
const SEPARATORS = "./:\\";

// Map: a primeira posição de cada chave fica e o último valor ganha, como no dict do Python.
const TABLE = new Map<string, CatalogHit>();
for (const entry of data.entries) {
  if (!CATEGORIES.includes(entry.category)) throw new Error(`categoria desconhecida no catálogo: ${entry.category}`);
  const hit = { category: entry.category as CatalogCategory, label: entry.label, technology: entry.technology };
  for (const name of entry.modules) TABLE.set(name.toLowerCase(), hit);
}

export function classify(moduleName: string): CatalogHit | null {
  const lowered = moduleName.toLowerCase();
  for (const [key, hit] of TABLE) {
    if (lowered === key || (lowered.startsWith(key) && SEPARATORS.includes(lowered[key.length]))) return hit;
  }
  return null;
}

export const catalogSize = TABLE.size;
