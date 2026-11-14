// Nome de uma imagem Docker -> que elemento do DFD é. Por exemplo "postgres:16" é uma base de dados PostgreSQL.
// As tecnologias que existem no catálogo (catalog.json) usam o mesmo slug, para os ids baterem com os do backend;
// as que só o overview conhece estão em OVERVIEW_ONLY.
import catalog from "../catalog.json";

export interface ImageHit {
  kind: "data_store" | "process";
  technology: string;
  tags: string[];
}

const store = (technology: string, ...tags: string[]): ImageHit => ({ kind: "data_store", technology, tags });
const proxy = (technology: string): ImageHit => ({ kind: "process", technology, tags: ["proxy"] });

const POSTGRES = store("postgresql");
const MYSQL = store("mysql");
const MONGO = store("mongodb");
const REDIS = store("redis");
const ELASTIC = store("elasticsearch");
const CASSANDRA = store("cassandra");
const KAFKA = store("kafka", "queue");

// Map y no um objeto: o nome vem de um ficheiro de qualquer pessoa, e em {} o nome "constructor" ou "__proto__" encontrava coisas que não são nossas.
const BY_NAME = new Map<string, ImageHit>(Object.entries({
  postgres: POSTGRES, postgresql: POSTGRES, postgis: POSTGRES, timescaledb: POSTGRES, pgvector: POSTGRES,
  mysql: MYSQL, "mysql-server": MYSQL, mariadb: MYSQL, percona: MYSQL,
  mongo: MONGO, mongodb: MONGO, "mongodb-community-server": MONGO,
  redis: REDIS, "redis-stack": REDIS, valkey: REDIS, keydb: REDIS, dragonfly: REDIS,
  elasticsearch: ELASTIC, opensearch: ELASTIC,
  cassandra: CASSANDRA, scylla: CASSANDRA,
  rabbitmq: store("rabbitmq", "queue"),
  kafka: KAFKA, "cp-kafka": KAFKA, redpanda: KAFKA,
  nats: store("message-queue", "queue"),
  mosquitto: store("mqtt", "queue"),
  memcached: store("memcached"), neo4j: store("neo4j"), couchdb: store("couchdb"), influxdb: store("influxdb"),
  "clickhouse-server": store("clickhouse"), minio: store("minio"),
  nginx: proxy("nginx"), traefik: proxy("traefik"), haproxy: proxy("haproxy"), caddy: proxy("caddy"),
  envoy: proxy("envoy"), httpd: proxy("httpd"), apache: proxy("httpd"),
}));

/** Tecnologias que não estão no catálogo: só o overview as conhece. */
export const OVERVIEW_ONLY = new Set([
  "mariadb", "mqtt", "memcached", "neo4j", "couchdb", "influxdb", "clickhouse", "minio",
  "nginx", "traefik", "haproxy", "caddy", "envoy", "httpd",
]);

export const CATALOG_TECHNOLOGIES = new Set(catalog.entries.map((e) => e.technology));
export const knownTechnologies = () => [...new Set([...BY_NAME.values()].map((hit) => hit.technology))];

/** "ghcr.io/acme/postgres:16@sha256:..." -> "postgres". */
export function imageName(image: string): string {
  const withoutDigest = image.split("@")[0];
  const last = withoutDigest.slice(withoutDigest.lastIndexOf("/") + 1);
  return last.split(":")[0].toLowerCase();
}

export function classifyImage(image: string): ImageHit | null {
  if (!image || image.includes("$")) return null;
  const hit = BY_NAME.get(imageName(image));
  return hit ? { ...hit, tags: [...hit.tags] } : null;
}
