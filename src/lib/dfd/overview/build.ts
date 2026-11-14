// Ficheiros de configuração -> grafo DFD de nível "overview" (docs/dfd-schema.md). Sem rede e sem relógio: recebe
// os ficheiros já descarregados e devolve o grafo, por isso corre em qualquer lado (página, extensão, testes).
//
// Regras:
//  - cada serviço do compose é um componente (processo) ou, se a imagem for uma base de dados ou uma fila, um depósito de dados;
//  - sem serviços de compose, cada pasta com manifesto é um componente (monorepos); sem nada disso, um só "Application";
//  - as dependências de produção que o catálogo reconhece viram bases de dados e serviços externos ligados ao componente;
//  - um depósito encontrado só por uma dependência junta-se ao único depósito do compose com a mesma tecnologia;
//  - tudo leva proveniência: de onde se tirou (ficheiro e linha) e com que confiança.
import catalog from "../catalog.json";
import type { Confidence, DfdGraph, Evidence, GraphEdge, GraphNode, Provenance } from "../schema";
import { mergeServices, parseCompose } from "./compose";
import type { ComposeService } from "./compose";
import { parseDockerfile } from "./dockerfile";
import { endpointsOf, parseEndpoints } from "./endpoints";
import { classifyImage, imageName } from "./images";
import { classifyDependency, parseManifest } from "./manifests";
import type { Manifest } from "./manifests";
import { fileKind } from "./select";
import { basename, dirname } from "./types";
import type { RepoFile } from "./types";

export interface OverviewInput {
  owner: string;
  repo: string;
  files: RepoFile[];
  /** Instante a pôr em meta.generated_at (para os testes serem estáveis). */
  now?: string;
}

const CLIENT_ID = "external_entity:client";
const APPLICATION_ID = "process:application";
const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const MAX_EVIDENCE = 6;

// Tecnologias do catálogo que são um protocolo ou uma biblioteca genérica, não um sistema com nome.
const GENERIC = new Set(["http-api", "websocket", "grpc", "auth-oauth-jwt", "file-storage"]);
// "SQL database" é o que um ORM (sqlalchemy, sequelize...) diz: há uma base de dados SQL, não qual. Liga-se à que já se conhece.
const SQL_DATABASES = new Set(["postgresql", "mysql", "sqlite"]);

const CATALOG_BY_TECHNOLOGY = new Map(catalog.entries.map((e) => [e.technology, e]));

const at = (file: string, line: number, note?: string): Evidence => ({ file, line, ...(note ? { note } : {}) });
const provenance = (confidence: Confidence, ...evidence: Evidence[]): Provenance => ({ source: "config", confidence, evidence });

// Pastas onde, por convenção, vivem as coisas que se executam (apps/web, services/billing, cmd/server...)...
const DEPLOY_PARENTS = new Set(["apps", "services", "servers", "cmd"]);
// ...e nomes de pastas na raiz que quase sempre são uma aplicação.
const APP_FOLDERS = new Set(["app", "api", "backend", "frontend", "server", "client", "web", "worker"]);

const claims = (component: string, dir: string) => component === "." || dir === component || dir.startsWith(`${component}/`);
const flowLabel = (node: GraphNode) => (node.kind === "data_store" ? (node.tags?.includes("queue") ? "publishes/consumes" : "reads/writes") : "calls");

function mergeProvenance(a: Provenance, b: Provenance): Provenance {
  const seen = new Set<string>();
  const evidence: Evidence[] = [];
  for (const item of [...a.evidence, ...b.evidence]) {
    const key = JSON.stringify(item);
    if (!seen.has(key) && evidence.length < MAX_EVIDENCE) {
      seen.add(key);
      evidence.push(item);
    }
  }
  const confidence = RANK[b.confidence] > RANK[a.confidence] ? b.confidence : a.confidence;
  return { source: a.source, confidence, evidence };
}

class Graph {
  nodes = new Map<string, GraphNode>();
  edges = new Map<string, GraphEdge>();

  addNode(node: GraphNode): GraphNode {
    const existing = this.nodes.get(node.id);
    if (!existing) {
      this.nodes.set(node.id, node);
      return node;
    }
    existing.provenance = mergeProvenance(existing.provenance, node.provenance);
    return existing;
  }

  addEdge(source: string, target: string, label: string, prov: Provenance, protocol: string | null = null) {
    if (source === target) return;
    const id = `${source}->${target}:${label}`;
    const existing = this.edges.get(id);
    if (!existing) this.edges.set(id, { id, source, target, label, protocol, provenance: prov });
    else {
      existing.provenance = mergeProvenance(existing.provenance, prov);
      existing.protocol ??= protocol;
    }
  }
}

export function buildOverview({ owner, repo, files, now }: OverviewInput): DfdGraph {
  const g = new Graph();
  const ofKind = (kind: string) => files.filter((f) => fileKind(f.path) === kind);
  const composeFiles = ofKind("compose");
  const services = mergeServices(composeFiles.flatMap(parseCompose));
  const dockerfiles = new Map(ofKind("dockerfile").map((f) => [f.path, parseDockerfile(f.text)]));
  const manifests = ofKind("manifest").map(parseManifest).filter((m) => m !== null);
  const configs = ofKind("config");

  // Um serviço que só tem "image:" costuma ser construído noutro sítio (CI, plugin do Maven): a pasta com o mesmo nome
  // que a imagem ("springcommunity/spring-petclinic-vets-service" -> spring-petclinic-vets-service/) é o seu código.
  const folders = [...new Set([...manifests.map((m) => m.dir), ...[...dockerfiles.keys()].map(dirname)])].filter((d) => d !== ".");
  const guessFolder = (s: ComposeService): string | null => {
    const named = (name: string) => folders.filter((d) => basename(d) === name);
    const attempts = [s.image ? named(imageName(s.image)) : [], named(s.name), folders.filter((d) => basename(d).endsWith(`-${s.name}`))];
    return attempts.find((found) => found.length === 1)?.[0] ?? null;
  };

  const taken = new Set<string>();
  const unique = (id: string) => {
    let candidate = id;
    for (let n = 2; taken.has(candidate); n++) candidate = `${id}-${n}`;
    taken.add(candidate);
    return candidate;
  };

  const serviceId = new Map<string, string>(); // "ficheiro|nome" -> id do nó
  const serviceByName = new Map<string, string>(); // nome -> id (o primeiro que aparecer)
  const components: { id: string; path: string }[] = []; // processos que sabemos onde vivem no repositório
  const buildDockerfiles = new Set<string>();

  // ---- 1. Serviços do compose
  for (const s of services) {
    const dockerfile = s.build ? dockerfiles.get(s.build.dockerfile) : undefined;
    if (s.build) buildDockerfiles.add(s.build.dockerfile);
    const byImage = s.image ? classifyImage(s.image) : null;
    const byBase = !byImage && dockerfile?.base ? classifyImage(dockerfile.base) : null;
    const hit = byImage ?? byBase;
    const declared = at(s.file, s.line, `service '${s.name}'`);

    let node: GraphNode;
    if (hit?.kind === "data_store") {
      const why = byImage ? `heuristic: image name '${s.image}'` : `heuristic: Dockerfile base image '${dockerfile?.base}'`;
      node = {
        id: unique(`data_store:${s.name}`), kind: "data_store", name: s.name, technology: hit.technology, tags: hit.tags,
        provenance: provenance(byImage ? "high" : "medium", declared, { note: why }),
      };
    } else {
      const guessed = s.build || hit ? null : guessFolder(s);
      const path = s.build?.sourceDir ?? guessed;
      node = {
        id: unique(path ? `process:${path}` : `process:${s.name}`), kind: "process", name: s.name,
        technology: hit?.technology ?? null, tags: hit?.tags ?? [], path,
        provenance: guessed ? provenance("medium", declared, { note: `heuristic: folder '${guessed}' matches the image or service name` }) : provenance("high", declared),
        extra: {
          ...(s.image ? { image: s.image } : {}),
          ...(s.ports.length ? { ports: s.ports.map((p) => p.published ?? p.target).filter((p) => p !== null) } : {}),
          ...(dockerfile?.expose.length ? { expose: dockerfile.expose } : {}),
        },
      };
      if (path) components.push({ id: node.id, path });
    }
    g.addNode(node);
    serviceId.set(`${s.file}|${s.name}`, node.id);
    if (!serviceByName.has(s.name)) serviceByName.set(s.name, node.id);
  }

  // ---- 2. Sem serviços de compose: pastas que se executam (monorepos) ou um só "Application"
  const isWeb = (m: Manifest) => m.dependencies.some((d) => classifyDependency(d)?.category === "entrypoint");
  const isRunnable = (m: Manifest) =>
    isWeb(m) ||
    [...dockerfiles.keys()].some((p) => dirname(p) === m.dir) ||
    DEPLOY_PARENTS.has(basename(dirname(m.dir))) ||
    (!m.dir.includes("/") && APP_FOLDERS.has(m.dir));

  let fallback: "application" | "manifests" | null = null;
  if (![...g.nodes.values()].some((n) => n.kind === "process")) {
    const dirs = [...new Set(manifests.filter(isRunnable).map((m) => m.dir))].filter((d) => d !== ".");
    if (dirs.length) {
      fallback = "manifests";
      for (const dir of dirs) {
        const manifest = manifests.find((m) => m.dir === dir && m.name) ?? manifests.find((m) => m.dir === dir)!;
        const id = unique(`process:${dir}`);
        g.addNode({
          id, kind: "process", name: manifest.name ?? basename(dir), path: dir, tags: [],
          provenance: provenance("medium", at(manifest.file, 1, "manifest")),
        });
        components.push({ id, path: dir });
      }
    } else {
      fallback = "application";
      const found = manifests[0] ? at(manifests[0].file, 1, "manifest") : { note: "no compose, Dockerfile or manifest found" };
      g.addNode({
        id: APPLICATION_ID, kind: "process", name: repo, path: ".", tags: [],
        provenance: provenance(manifests.length || composeFiles.length || dockerfiles.size ? "medium" : "low", found),
      });
      components.push({ id: APPLICATION_ID, path: "." });
    }
  }

  const ownerOf = (dir: string): string | null => {
    let best: { id: string; path: string } | null = null;
    for (const c of components) {
      if (claims(c.path, dir) && (!best || (c.path === "." ? 0 : c.path.length) > (best.path === "." ? 0 : best.path.length))) best = c;
    }
    return best?.id ?? null;
  };

  // Um depósito encontrado por uma dependência ou por um endereço, e não por um serviço do compose.
  const storeFor = (technology: string, ev: Evidence, confidence: Confidence): string | null => {
    const entry = CATALOG_BY_TECHNOLOGY.get(technology);
    if (!entry || (entry.category !== "datastore" && entry.category !== "queue")) return null;
    const anonymous = `data_store:${technology}`;
    const matches = (n: GraphNode) => (technology === "sql-database" ? SQL_DATABASES.has(n.technology ?? "") : n.technology === technology);
    const instances = [...g.nodes.values()].filter((n) => n.kind === "data_store" && n.id !== anonymous && matches(n));
    if (instances.length === 1) return instances[0].id;
    g.addNode({
      id: anonymous, kind: "data_store", name: entry.label, technology, tags: entry.category === "queue" ? ["queue"] : [],
      provenance: provenance(instances.length > 1 ? "low" : confidence, ev),
    });
    return anonymous;
  };

  const connect = (sourceId: string, targetId: string | null, prov: Provenance, label?: string, protocol: string | null = null) => {
    const target = targetId ? g.nodes.get(targetId) : undefined;
    if (!target || g.nodes.get(sourceId)?.kind === "data_store") return;
    g.addEdge(sourceId, targetId!, label ?? flowLabel(target), prov, protocol);
  };

  const web = new Map<string, Evidence[]>(); // componente -> provas de que serve HTTP
  const exposed = new Map<string, Evidence[]>(); // componente -> provas de que tem portas acessíveis
  const note = (map: Map<string, Evidence[]>, id: string, ev: Evidence) => map.set(id, [...(map.get(id) ?? []), ev]);
  // Ligações a uma tecnologia genérica ("SQL database", dita por um ORM) esperam que as específicas já existam,
  // senão dependia da ordem em que se leem as dependências.
  const deferred: (() => void)[] = [];

  // ---- 3. Dependências dos manifestos
  // Um componente usa também o que as bibliotecas do mesmo repositório de que depende usam: em "apps/web" que depende de
  // "@acme/db" (packages/db), a base de dados de packages/db é do apps/web. Reconhecem-se pelo nome do manifesto.
  const byName = new Map<string, Manifest[]>();
  for (const m of manifests) if (m.name) byName.set(m.name, [...(byName.get(m.name) ?? []), m]);
  const reachable = (own: Manifest[]): Manifest[] => {
    const seen = new Set<Manifest>();
    const queue = [...own];
    for (let m = queue.shift(); m; m = queue.shift()) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const d of m.dependencies) queue.push(...(byName.get(d.name) ?? []));
    }
    return [...seen];
  };

  for (const component of components) {
    const own = manifests.filter((m) => ownerOf(m.dir) === component.id);
    for (const m of reachable(own)) {
      for (const dep of m.dependencies) {
        const hit = classifyDependency(dep);
        if (!hit) continue;
        const ev = at(m.file, dep.line, `dependency ${dep.name}`);
        if (hit.category === "entrypoint") {
          if (own.includes(m)) note(web, component.id, ev); // que o serviço responda a HTTP é com as suas próprias dependências
        } else if (hit.category === "external") {
          if (GENERIC.has(hit.technology)) continue;
          const id = `external_entity:${hit.technology}`;
          g.addNode({ id, kind: "external_entity", name: hit.label, technology: hit.technology, tags: ["third-party"], provenance: provenance("medium", ev) });
          connect(component.id, id, provenance("medium", ev));
        } else if (hit.technology === "sql-database") {
          deferred.push(() => connect(component.id, storeFor(hit.technology, ev, "medium"), provenance("medium", ev)));
        } else connect(component.id, storeFor(hit.technology, ev, "medium"), provenance("medium", ev));
      }
    }
  }

  // ---- 4. Compose: dependências entre serviços, endereços nas variáveis e portas publicadas
  const resolve = (s: ComposeService, host: string) => serviceId.get(`${s.file}|${host}`);
  for (const s of services) {
    const sourceId = serviceId.get(`${s.file}|${s.name}`)!;
    const source = g.nodes.get(sourceId)!;
    for (const dep of s.dependsOn) {
      const targetId = resolve(s, dep.name);
      const target = targetId ? g.nodes.get(targetId) : undefined;
      if (target) connect(sourceId, targetId!, provenance("medium", at(dep.file, dep.line, `depends_on ${dep.name}`)), target.kind === "process" ? "depends on" : undefined);
    }
    for (const env of s.environment) {
      for (const ep of endpointsOf(env.file, env)) {
        const ev = at(env.file, ep.line, `${ep.key} points at '${ep.host}'`);
        const targetId = resolve(s, ep.host);
        if (targetId) connect(sourceId, targetId, provenance("high", ev), undefined, ep.protocol);
        else if (ep.technology) connect(sourceId, storeFor(ep.technology, ev, "medium"), provenance("medium", ev), undefined, ep.protocol);
      }
    }
    if (source.kind === "process") {
      for (const port of s.ports.filter((p) => p.public)) note(exposed, sourceId, at(port.file, port.line, `published port ${port.published ?? port.target ?? ""}`.trim()));
    }
  }

  // ---- 5. Ficheiros de configuração (application.yml, .env.example)
  for (const file of configs) {
    const componentId = ownerOf(dirname(file.path));
    if (!componentId) continue;
    for (const ep of parseEndpoints(file)) {
      const ev = at(file.path, ep.line, `${ep.key} points at '${ep.host}'`);
      const targetId = serviceByName.get(ep.host);
      if (targetId) connect(componentId, targetId, provenance("high", ev), undefined, ep.protocol);
      else if (ep.technology) connect(componentId, storeFor(ep.technology, ev, "medium"), provenance("medium", ev), undefined, ep.protocol);
    }
  }

  deferred.forEach((run) => run());

  // ---- 6. Dockerfiles que o compose não constrói: as portas que expõem
  for (const [path, info] of dockerfiles) {
    const componentId = buildDockerfiles.has(path) ? null : ownerOf(dirname(path));
    if (componentId && info.expose.length) note(exposed, componentId, at(path, info.baseLine ?? 1, `EXPOSE ${info.expose.join(" ")}`));
  }

  // ---- 7. O cliente: quem serve HTTP ou tem portas acessíveis recebe pedidos de fora
  for (const id of new Set([...web.keys(), ...exposed.keys()])) {
    const evidence = [...(web.get(id) ?? []), ...(exposed.get(id) ?? [])];
    g.addNode({
      id: CLIENT_ID, kind: "external_entity", name: "User / Client", tags: ["client"],
      provenance: provenance("medium", { note: "inferred from web frameworks and published ports" }),
    });
    g.addEdge(CLIENT_ID, id, web.has(id) ? "HTTP requests" : "network access", provenance("medium", ...evidence));
  }

  const order = { process: 0, data_store: 1, external_entity: 2 };
  return {
    schema_version: "1",
    repository: { owner, repo, ref: null },
    level: "overview",
    nodes: [...g.nodes.values()].sort((a, b) => order[a.kind] - order[b.kind]),
    edges: [...g.edges.values()],
    meta: {
      producer: "browser-overview",
      generated_at: now ?? new Date().toISOString(),
      inputs: files.map((f) => f.path),
      ...(fallback ? { fallback } : {}),
    },
  };
}
