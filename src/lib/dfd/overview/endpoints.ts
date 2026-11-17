// Nomes de máquinas que aparecem em configuração: "DATABASE_URL=postgres://user:segredo@db:5432/app" diz que este
// componente fala com a máquina "db" por PostgreSQL. Só se guardam a máquina, a porta, o esquema e o nome da chave;
// as credenciais e o resto do valor nunca saem daqui.
import { parseAllDocuments } from "yaml";
import { LineFinder, basename } from "./types";
import type { RepoFile } from "./types";

export interface Endpoint {
  file: string;
  line: number;
  /** Nome da chave de onde veio (por exemplo "DATABASE_URL"); nunca o valor. */
  key: string;
  host: string;
  port: number | null;
  /** Slug do catálogo (postgresql, redis...) quando o esquema ou a chave o dizem. */
  technology: string | null;
  /** "http", "https", "postgres"...: o esquema do URL. */
  protocol: string | null;
}

export interface Pair {
  key: string;
  value: string;
  line: number;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "host.docker.internal"]);

const BY_SCHEME = new Map<string, string>(Object.entries({
  postgres: "postgresql", postgresql: "postgresql", mysql: "mysql", mariadb: "mysql",
  mongodb: "mongodb", "mongodb+srv": "mongodb", redis: "redis", rediss: "redis", amqp: "rabbitmq", amqps: "rabbitmq", kafka: "kafka",
}));
const BY_KEY: [RegExp, string][] = [
  [/postgres|pg_?host|pghost/i, "postgresql"], [/mysql|mariadb/i, "mysql"], [/mongo/i, "mongodb"], [/redis/i, "redis"],
  [/rabbit|amqp/i, "rabbitmq"], [/kafka/i, "kafka"], [/elastic|opensearch/i, "elasticsearch"], [/cassandra/i, "cassandra"],
];
const HOST_KEY = /(^|[._-])(host|hostname|server|endpoint|brokers?|bootstrap[._-]?servers)$/i;
const URL_PATTERN = /([a-z][a-z0-9+.-]*):\/\/(?:[^\s/@]*@)?(\[[^\]]+\]|[^\s/:?#,;'"]+)(?::(\d+))?/gi;

const usable = (host: string) => host !== "" && !host.includes("$") && !host.includes("{") && !LOCAL_HOSTS.has(host.toLowerCase());

const technologyFromKey = (key: string): string | null => BY_KEY.find(([pattern]) => pattern.test(key))?.[1] ?? null;

/** Máquinas que um par chave/valor aponta. */
export function endpointsOf(file: string, pair: Pair): Endpoint[] {
  const out: Endpoint[] = [];
  const value = pair.value.trim().replace(/^jdbc:/i, "");

  for (const match of value.matchAll(URL_PATTERN)) {
    const scheme = match[1].toLowerCase();
    const host = match[2].toLowerCase();
    if (!usable(host)) continue;
    out.push({
      file, line: pair.line, key: pair.key, host, port: match[3] ? Number(match[3]) : null,
      technology: BY_SCHEME.get(scheme) ?? BY_SCHEME.get(scheme.split("+")[0]) ?? technologyFromKey(pair.key), protocol: scheme,
    });
  }
  if (out.length === 0 && HOST_KEY.test(pair.key) && value && !/\s/.test(value.replace(/,\s*/g, ","))) {
    for (const part of value.split(",")) {
      const [host, port] = part.trim().split(":");
      if (usable(host ?? "") && /^[\w.-]+$/.test(host)) {
        out.push({ file, line: pair.line, key: pair.key, host: host.toLowerCase(), port: port && /^\d+$/.test(port) ? Number(port) : null, technology: technologyFromKey(pair.key), protocol: null });
      }
    }
  }
  return out;
}

function flatten(value: unknown, prefix: string, into: [string, string][]) {
  if (Array.isArray(value)) value.forEach((item) => flatten(item, prefix, into));
  else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${key}` : key, into);
  } else if (typeof value === "string" || typeof value === "number") into.push([prefix, String(value)]);
}

/** Pares chave/valor de um ficheiro de configuração (.env, .properties ou YAML). */
export function pairsOf(file: RepoFile): Pair[] {
  const name = basename(file.path).toLowerCase();
  const pairs: Pair[] = [];
  if (/\.ya?ml$/.test(name)) {
    // application.yml costuma ter vários documentos separados por "---" (um por perfil)
    const flat: [string, string][] = [];
    try {
      for (const document of parseAllDocuments(file.text)) flatten(document.toJS({ maxAliasCount: 100 }), "", flat);
    } catch {
      return [];
    }
    const finder = new LineFinder(file.text);
    for (const [key, value] of flat) pairs.push({ key, value, line: finder.findKey(key.slice(key.lastIndexOf(".") + 1)).line });
    return pairs;
  }
  file.text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) return;
    const match = line.replace(/^export\s+/, "").match(/^([\w.\-[\]]+)\s*[=:]\s*(.*)$/);
    if (match) pairs.push({ key: match[1], value: match[2].replace(/^["']|["']$/g, ""), line: index + 1 });
  });
  return pairs;
}

export function parseEndpoints(file: RepoFile): Endpoint[] {
  return pairsOf(file).flatMap((pair) => endpointsOf(file.path, pair));
}
