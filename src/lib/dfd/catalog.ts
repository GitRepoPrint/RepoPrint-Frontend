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

// A primeira posição de cada chave fica e o último valor ganha, como no dict do Python; `order` é essa posição.
interface Entry extends CatalogHit {
  order: number;
}
const TABLE = new Map<string, Entry>();
for (const entry of data.entries) {
  if (!CATEGORIES.includes(entry.category)) throw new Error(`categoria desconhecida no catálogo: ${entry.category}`);
  for (const name of entry.modules) {
    const key = name.toLowerCase();
    const order = TABLE.get(key)?.order ?? TABLE.size;
    TABLE.set(key, { category: entry.category as CatalogCategory, label: entry.label, technology: entry.technology, order });
  }
}
const LONGEST_KEY = Math.max(...[...TABLE.keys()].map((key) => key.length));

/**
 * Uma chave bate se for igual ao nome ou se o nome começar por ela e a seguir vier um separador. Pode bater mais do que
 * uma ("org.springframework.web" e "org.springframework.web.bind"): ganha a que está primeiro no catálogo, como no backend.
 * Só se experimentam os prefixos que acabam num separador, por isso o custo é o tamanho do nome e não o do catálogo.
 */
export function classify(moduleName: string): CatalogHit | null {
  const lowered = moduleName.toLowerCase();
  let best: Entry | null = null;
  for (let end = 1; end <= Math.min(lowered.length, LONGEST_KEY + 1); end++) {
    if (end < lowered.length && !SEPARATORS.includes(lowered[end])) continue;
    const found = TABLE.get(lowered.slice(0, end));
    if (found && (!best || found.order < best.order)) best = found;
  }
  return best && { category: best.category, label: best.label, technology: best.technology };
}

export const catalogSize = TABLE.size;

/** "SQL database" é o que um ORM (sqlalchemy, sequelize...) diz: há uma base de dados SQL, não qual. Estas são as que ela pode ser. */
export const SQL_DATABASES: ReadonlySet<string> = new Set(["postgresql", "mysql", "sqlite"]);

/**
 * Tecnologias do catálogo que são um protocolo ou uma biblioteca genérica, não um sistema com nome: um cliente HTTP
 * qualquer, WebSocket, gRPC, JWT. Dizem como se fala, não com quem.
 */
export const GENERIC_TECHNOLOGIES: ReadonlySet<string> = new Set(["http-api", "websocket", "grpc", "auth-oauth-jwt", "file-storage"]);
