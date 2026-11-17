// docker-compose / compose.yaml -> serviços. Só se lê o que descreve a arquitetura: imagem, build, portas, dependências
// e variáveis de ambiente. Os valores das variáveis só servem para achar nomes de máquinas (ver endpoints.ts) e
// nunca se guardam.
import { LineCounter, isMap, parseDocument } from "yaml";
import type { Scalar } from "yaml";
import { LineFinder, basename, dirname, joinPath } from "./types";
import type { RepoFile } from "./types";

export interface PortSpec {
  /** Porta no anfitrião, se for um número. */
  published: number | null;
  target: number | null;
  /** true se a porta é publicada no anfitrião (mesmo que o número venha de uma variável). */
  public: boolean;
}

/** Onde, em que ficheiro, algo foi declarado: o serviço pode estar num ficheiro e a porta num override. */
export interface Declared {
  file: string;
  line: number;
}

export type ComposePort = PortSpec & Declared;
export type ComposeDependency = { name: string } & Declared;

export interface ComposeEnv {
  key: string;
  value: string;
  file: string;
  line: number;
}

export interface ComposeService {
  name: string;
  file: string;
  /** Linha em que o serviço começa. */
  line: number;
  image: string | null;
  /**
   * Se o serviço é construído: a pasta de build e o Dockerfile (relativos à raiz do repositório) e a pasta do código.
   * A pasta do código é a do Dockerfile quando este se chama "Dockerfile" ou "Dockerfile.variante" e está dentro do
   * contexto ("context: ." com "dockerfile: backend/Dockerfile" é o código de backend/); com outro nome
   * ("docker/api.Dockerfile") a pasta só tem Dockerfiles e o código é o próprio contexto.
   */
  build: { context: string; dockerfile: string; sourceDir: string } | null;
  ports: ComposePort[];
  dependsOn: ComposeDependency[];
  environment: ComposeEnv[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const asString = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);

const firstNumber = (text: string): number | null => {
  const match = text.match(/^\d+/);
  return match ? Number(match[0]) : null;
};

/** "8080:80", "127.0.0.1:8080:80/tcp", "80", "${PORT:-8000}:8000" ou {target, published}. */
export function parsePort(value: unknown): PortSpec | null {
  if (isRecord(value)) {
    const published = value.published === undefined ? null : Number(value.published) || null;
    return { published, target: Number(value.target) || null, public: value.published !== undefined };
  }
  const text = asString(value);
  if (!text) return null;
  // sem o protocolo e sem partir as variáveis ${...:-...} (têm ":" lá dentro)
  const plain = text.replace(/\/(tcp|udp|sctp)$/i, "").replace(/\$\{[^}]*\}/g, (m) => `v${m.length}`);
  const parts = plain.split(":");
  if (parts.length === 1) return { published: null, target: firstNumber(parts[0]), public: false };
  const target = firstNumber(parts[parts.length - 1]);
  const host = parts[parts.length - 2];
  return { published: firstNumber(host), target, public: true };
}

function parseEnvironment(value: unknown, file: string, finder: LineFinder, from: number): ComposeEnv[] {
  const entries: [string, string][] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const raw = asString(item);
      if (raw) entries.push([raw.split("=")[0], raw.includes("=") ? raw.slice(raw.indexOf("=") + 1) : ""]);
    }
  } else if (isRecord(value)) {
    for (const [key, v] of Object.entries(value)) entries.push([key, v === null || v === undefined ? "" : String(v)]);
  }
  // as variáveis de um serviço aparecem pela ordem em que as lemos: cada procura começa onde acabou a anterior
  let cursor = from;
  return entries.map(([key, v]) => {
    const found = finder.findKey(key, cursor);
    if (found.index >= 0) cursor = found.index + key.length;
    return { key, value: v, file, line: found.line };
  });
}

function parseBuild(value: unknown, composeDir: string): ComposeService["build"] {
  if (value === undefined || value === null) return null;
  const context = typeof value === "string" ? value : isRecord(value) ? (asString(value.context) ?? ".") : null;
  if (context === null) return null;
  const root = joinPath(composeDir, context);
  const dockerfile = isRecord(value) && asString(value.dockerfile) ? joinPath(root, asString(value.dockerfile)!) : joinPath(root, "Dockerfile");
  const folder = dirname(dockerfile);
  const inside = root === "." || folder === root || folder.startsWith(`${root}/`);
  return { context: root, dockerfile, sourceDir: /^Dockerfile(\..+)?$/.test(basename(dockerfile)) && inside ? folder : root };
}

function parseDependsOn(def: Record<string, unknown>): string[] {
  const names: string[] = [];
  const dependsOn = def.depends_on;
  if (Array.isArray(dependsOn)) names.push(...dependsOn.filter((v): v is string => typeof v === "string"));
  else if (isRecord(dependsOn)) names.push(...Object.keys(dependsOn));
  if (Array.isArray(def.links)) {
    names.push(...def.links.filter((v): v is string => typeof v === "string").map((link) => link.split(":")[0]));
  }
  return [...new Set(names)];
}

export function parseCompose(file: RepoFile): ComposeService[] {
  const lineCounter = new LineCounter();
  let document;
  try {
    // merge: chaves "<<: *base" (muito usadas para partilhar configuração entre serviços)
    document = parseDocument(file.text, { lineCounter, merge: true });
  } catch {
    return [];
  }
  const servicesNode = document.get("services", true);
  let root: unknown;
  try {
    root = document.toJS({ maxAliasCount: 100 });
  } catch {
    return []; // mais referências (aliases) do que as que um ficheiro de verdade tem: ataque de esgotamento de recursos
  }
  if (!isMap(servicesNode) || !isRecord(root) || !isRecord(root.services)) return [];
  const finder = new LineFinder(file.text);
  const composeDir = dirname(file.path);

  const services: ComposeService[] = [];
  for (const pair of servicesNode.items) {
    const key = pair.key as Scalar | null;
    const name = key ? String(key.value) : "";
    if (!key || !(name in root.services)) continue; // por exemplo uma chave "<<" de fusão
    const def = root.services[name];
    const body = isRecord(def) ? def : {};
    const value = pair.value as { range?: [number, number, number] | null } | null;
    const start = value?.range?.[0] ?? key.range![0];
    const line = lineCounter.linePos(key.range![0]).line;
    services.push({
      name,
      file: file.path,
      line,
      image: asString(body.image),
      build: parseBuild(body.build, composeDir),
      ports: (Array.isArray(body.ports) ? body.ports : [])
        .map(parsePort)
        .filter((p): p is PortSpec => p !== null)
        .map((p) => ({ ...p, file: file.path, line })),
      dependsOn: parseDependsOn(body).map((name) => ({ name, file: file.path, line })),
      environment: parseEnvironment(body.environment, file.path, finder, start),
    });
  }
  return services;
}

/** Sem repetidos pela chave; fica o primeiro de cada um, ou o último com `keep: "last"` (para um override ganhar). */
function uniqueBy<T>(items: T[], key: (item: T) => string, keep: "first" | "last" = "first"): T[] {
  const kept = new Map<string, T>();
  for (const item of items) if (keep === "last" || !kept.has(key(item))) kept.set(key(item), item);
  return [...kept.values()];
}

/**
 * Junta os serviços do mesmo nome que aparecem em vários ficheiros compose da mesma pasta (base + overrides), como o
 * docker compose: imagem e build do último que os define; portas, dependências e variáveis acumulam-se.
 * A declaração (ficheiro e linha) é a do primeiro ficheiro onde o serviço aparece.
 */
export function mergeServices(services: ComposeService[]): ComposeService[] {
  const merged = new Map<string, ComposeService>();
  for (const s of services) {
    const key = `${dirname(s.file)}|${s.name}`;
    const base = merged.get(key);
    if (!base) {
      merged.set(key, { ...s });
      continue;
    }
    base.image = s.image ?? base.image;
    base.build = s.build ?? base.build;
    base.ports = uniqueBy([...base.ports, ...s.ports], (p) => `${p.published}:${p.target}:${p.public}`);
    base.dependsOn = uniqueBy([...base.dependsOn, ...s.dependsOn], (d) => d.name);
    base.environment = uniqueBy([...base.environment.filter((e) => !s.environment.some((o) => o.key === e.key)), ...s.environment], (e) => e.key, "last");
  }
  return [...merged.values()];
}
