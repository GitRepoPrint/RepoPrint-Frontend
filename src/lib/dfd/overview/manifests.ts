// Manifestos de dependências -> que bibliotecas um componente usa. Só dependências de produção: as de teste e de
// desenvolvimento não são parte do sistema. As dependências que o catálogo reconhece (base de dados, fila, serviço
// externo, framework web) é que viram elementos do diagrama.
import { parse as parseToml } from "smol-toml";
import { classify } from "../catalog";
import type { CatalogHit } from "../catalog";
import { LineFinder, basename, dirname } from "./types";
import type { RepoFile } from "./types";

export type ManifestKind = "npm" | "python" | "maven" | "gradle" | "go" | "cargo";

export interface Dependency {
  name: string;
  /** Outros nomes com que o catálogo pode reconhecer a mesma dependência (por exemplo o groupId de um pom). */
  alternates: string[];
  line: number;
}

export interface Manifest {
  /** Pasta do manifesto, relativa à raiz do repositório ("." na raiz). */
  dir: string;
  file: string;
  kind: ManifestKind;
  name: string | null;
  dependencies: Dependency[];
}

// Um manifesto de verdade tem dezenas de dependências, não milhares; o resto seria tempo perdido num ficheiro hostil.
export const MAX_DEPENDENCIES = 2000;

// O catálogo tem nomes de import; as distribuições de Python e os starters do Spring chamam-se de outra maneira.
const ALIASES: Record<string, string> = {
  "psycopg2-binary": "psycopg2", mysqlclient: "mysql", "mysql-connector-python": "mysql.connector",
  "python-redis": "redis", "spring-boot-starter-web": "org.springframework.web", "spring-boot-starter-webmvc": "org.springframework.web",
  "spring-boot-starter-webflux": "org.springframework.web",
  "spring-boot-starter-data-jpa": "org.springframework.data", "spring-boot-starter-jdbc": "org.springframework.jdbc",
  "spring-boot-starter-data-redis": "redis", "spring-boot-starter-data-mongodb": "mongodb",
  "spring-boot-starter-amqp": "org.springframework.amqp", "spring-boot-starter-data-elasticsearch": "org.elasticsearch",
};

// O catálogo (partilhado com o backend) conhece frameworks de servidor; as de interface, que também respondem a pedidos
// HTTP do navegador, só interessam ao overview.
const WEB_FRONTENDS = new Set(["react-dom", "vue", "@angular/core", "svelte", "vite", "nuxt", "solid-js", "preact", "astro", "@remix-run/react"]);
const WEB_FRONTEND_HIT: CatalogHit = { category: "entrypoint", label: "Web frontend", technology: "web-frontend" };
// O gateway do Spring Cloud tem um nome por versão (spring-cloud-starter-gateway, -gateway-server-webmvc...)
const SPRING_GATEWAY = /^spring-cloud-starter-gateway/;

/** Procura o nome no catálogo; nomes com "-" (distribuições Python, crates) tentam-se também com "_", "." e "/". */
export function classifyDependency(dependency: Pick<Dependency, "name" | "alternates">): CatalogHit | null {
  for (const name of [dependency.name, ...dependency.alternates]) {
    const lowered = name.toLowerCase();
    if (WEB_FRONTENDS.has(lowered)) return WEB_FRONTEND_HIT;
    if (SPRING_GATEWAY.test(lowered)) return classify("org.springframework.web");
    const candidates = [ALIASES[lowered], lowered, lowered.replace(/-/g, "_"), lowered.replace(/-/g, "."), lowered.replace(/-/g, "/")];
    for (const candidate of candidates) {
      const hit = candidate ? classify(candidate) : null;
      if (hit) return hit;
    }
  }
  return null;
}

const capped = (dependencies: Dependency[]) => dependencies.slice(0, MAX_DEPENDENCIES);

function parseNpm(file: RepoFile): Omit<Manifest, "dir" | "file"> | null {
  let json: unknown;
  try {
    json = JSON.parse(file.text);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const pkg = json as Record<string, unknown>;
  const finder = new LineFinder(file.text);
  const names = [pkg.dependencies, pkg.optionalDependencies].flatMap((d) => (d && typeof d === "object" ? Object.keys(d) : [])).slice(0, MAX_DEPENDENCIES);
  return {
    kind: "npm",
    name: typeof pkg.name === "string" ? pkg.name : null,
    dependencies: names.map((name) => ({ name, alternates: [], line: finder.findJsonKey(name).line })),
  };
}

const PEP508_NAME = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/;

function parsePyproject(file: RepoFile): Omit<Manifest, "dir" | "file"> | null {
  let toml: Record<string, unknown>;
  try {
    toml = parseToml(file.text) as Record<string, unknown>;
  } catch {
    return null;
  }
  const project = (toml.project ?? {}) as Record<string, unknown>;
  const poetry = ((toml.tool as Record<string, unknown> | undefined)?.poetry ?? {}) as Record<string, unknown>;
  const names: string[] = [];
  if (Array.isArray(project.dependencies)) {
    for (const item of project.dependencies) {
      const match = typeof item === "string" ? item.match(PEP508_NAME) : null;
      if (match) names.push(match[1]);
    }
  }
  if (poetry.dependencies && typeof poetry.dependencies === "object") {
    names.push(...Object.keys(poetry.dependencies).filter((n) => n.toLowerCase() !== "python"));
  }
  const name = typeof project.name === "string" ? project.name : typeof poetry.name === "string" ? poetry.name : null;
  const finder = new LineFinder(file.text);
  return { kind: "python", name, dependencies: names.slice(0, MAX_DEPENDENCIES).map((n) => ({ name: n, alternates: [], line: finder.find(`"${n}`).line })) };
}

function parseRequirements(file: RepoFile): Omit<Manifest, "dir" | "file"> {
  const dependencies: Dependency[] = [];
  file.text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.split("#")[0].trim();
    if (!line || line.startsWith("-")) return; // opções como -r outro.txt ou -e .
    const match = line.match(PEP508_NAME);
    if (match) dependencies.push({ name: match[1], alternates: [], line: index + 1 });
  });
  return { kind: "python", name: null, dependencies: capped(dependencies) };
}

/** Troca por espaços (menos as quebras de linha) tudo o que está entre `open` e `close`, de uma só passagem. */
function blankOut(text: string, open: string, close: string): string {
  let out = "";
  let position = 0;
  for (;;) {
    const start = text.indexOf(open, position);
    if (start < 0) break;
    const end = text.indexOf(close, start + open.length);
    const stop = end < 0 ? text.length : end + close.length; // sem fecho: o resto do ficheiro
    out += text.slice(position, start) + text.slice(start, stop).replace(/[^\n]/g, " ");
    position = stop;
  }
  return out + text.slice(position);
}

/** Conteúdo de <name>...</name> (o primeiro), sem expressões regulares que voltem atrás. */
function tag(block: string, name: string): string | null {
  const open = block.indexOf(`<${name}>`);
  if (open < 0) return null;
  const from = open + name.length + 2;
  const close = block.indexOf(`</${name}>`, from);
  return close < 0 ? null : block.slice(from, close).trim();
}

function parsePom(file: RepoFile): Omit<Manifest, "dir" | "file"> {
  // sem comentários, sem dependencyManagement (só versões) e sem build (os plugins têm as suas dependências)
  const pom = blankOut(blankOut(blankOut(file.text, "<!--", "-->"), "<dependencyManagement>", "</dependencyManagement>"), "<build>", "</build>");
  const finder = new LineFinder(file.text);
  const dependencies: Dependency[] = [];
  for (let at = pom.indexOf("<dependency>"); at >= 0 && dependencies.length < MAX_DEPENDENCIES; ) {
    const close = pom.indexOf("</dependency>", at);
    const block = pom.slice(at + "<dependency>".length, close < 0 ? pom.length : close);
    const group = tag(block, "groupId");
    const artifact = tag(block, "artifactId");
    if (artifact && tag(block, "scope") !== "test") {
      const line = finder.find(`<artifactId>${artifact}</artifactId>`, at).line;
      dependencies.push({ name: artifact, alternates: group ? [group, `${group}.${artifact}`] : [], line });
    }
    at = close < 0 ? -1 : pom.indexOf("<dependency>", close);
  }
  const header = blankOut(blankOut(pom, "<parent>", "</parent>"), "<dependencies>", "</dependencies>");
  return { kind: "maven", name: tag(header, "artifactId"), dependencies };
}

const GRADLE_DEPENDENCY = /^\s*(?:implementation|api|compile|runtimeOnly|runtime)\s*\(?\s*['"]([\w.-]+):([\w.-]+)(?::[^'"]*)?['"]/;

function parseGradle(file: RepoFile): Omit<Manifest, "dir" | "file"> {
  const dependencies: Dependency[] = [];
  file.text.split(/\r?\n/).forEach((raw, index) => {
    const match = raw.match(GRADLE_DEPENDENCY);
    if (match) dependencies.push({ name: match[2], alternates: [match[1], `${match[1]}.${match[2]}`], line: index + 1 });
  });
  return { kind: "gradle", name: null, dependencies: capped(dependencies) };
}

function parseGoMod(file: RepoFile): Omit<Manifest, "dir" | "file"> {
  const dependencies: Dependency[] = [];
  let name: string | null = null;
  let inBlock = false;
  file.text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const declared = line.match(/^module\s+(\S+)/);
    if (declared) name = declared[1];
    if (/^require\s*\($/.test(line)) return void (inBlock = true);
    if (inBlock && line === ")") return void (inBlock = false);
    const single = line.match(/^require\s+(\S+)\s+\S+/);
    const entry = inBlock ? line.match(/^(\S+)\s+\S+/) : single;
    if (entry && !line.includes("// indirect") && !line.startsWith("//")) dependencies.push({ name: entry[1], alternates: [], line: index + 1 });
  });
  return { kind: "go", name, dependencies: capped(dependencies) };
}

function parseCargo(file: RepoFile): Omit<Manifest, "dir" | "file"> | null {
  let toml: Record<string, unknown>;
  try {
    toml = parseToml(file.text) as Record<string, unknown>;
  } catch {
    return null;
  }
  const names = (toml.dependencies && typeof toml.dependencies === "object" ? Object.keys(toml.dependencies) : []).slice(0, MAX_DEPENDENCIES);
  const pkg = (toml.package ?? {}) as Record<string, unknown>;
  const finder = new LineFinder(file.text);
  return {
    kind: "cargo",
    name: typeof pkg.name === "string" ? pkg.name : null,
    dependencies: names.map((n) => ({ name: n, alternates: [], line: finder.findKey(n).line })),
  };
}

export function parseManifest(file: RepoFile): Manifest | null {
  const name = basename(file.path);
  let parsed: Omit<Manifest, "dir" | "file"> | null = null;
  if (name === "package.json") parsed = parseNpm(file);
  else if (name === "pyproject.toml") parsed = parsePyproject(file);
  else if (name === "requirements.txt") parsed = parseRequirements(file);
  else if (name === "pom.xml") parsed = parsePom(file);
  else if (name === "build.gradle" || name === "build.gradle.kts") parsed = parseGradle(file);
  else if (name === "go.mod") parsed = parseGoMod(file);
  else if (name === "Cargo.toml") parsed = parseCargo(file);
  return parsed ? { dir: dirname(file.path), file: file.path, ...parsed } : null;
}
