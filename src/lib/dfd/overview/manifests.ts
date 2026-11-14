// Manifestos de dependências -> que bibliotecas um componente usa. Só dependências de produção: as de teste e de
// desenvolvimento não são parte do sistema. As dependências que o catálogo reconhece (base de dados, fila, serviço
// externo, framework web) é que viram elementos do diagrama.
import { parse as parseToml } from "smol-toml";
import { classify } from "../catalog";
import type { CatalogHit } from "../catalog";
import { basename, dirname, lineOf } from "./types";
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

// O catálogo tem nomes de import; as distribuições de Python e os starters do Spring chamam-se de outra maneira.
const ALIASES: Record<string, string> = {
  "psycopg2-binary": "psycopg2", mysqlclient: "mysql", "mysql-connector-python": "mysql.connector",
  "python-redis": "redis", "spring-boot-starter-web": "org.springframework.web", "spring-boot-starter-webmvc": "org.springframework.web",
  "spring-boot-starter-webflux": "org.springframework.web",
  "spring-boot-starter-data-jpa": "org.springframework.data", "spring-boot-starter-jdbc": "org.springframework.jdbc",
  "spring-boot-starter-data-redis": "redis", "spring-boot-starter-data-mongodb": "mongodb",
  "spring-boot-starter-amqp": "org.springframework.amqp", "spring-boot-starter-data-elasticsearch": "org.elasticsearch",
};

/** Procura o nome no catálogo; nomes com "-" (distribuições Python, crates) tentam-se também com "_", "." e "/". */
export function classifyDependency(dependency: Pick<Dependency, "name" | "alternates">): CatalogHit | null {
  for (const name of [dependency.name, ...dependency.alternates]) {
    const lowered = name.toLowerCase();
    const candidates = [ALIASES[lowered], lowered, lowered.replace(/-/g, "_"), lowered.replace(/-/g, "."), lowered.replace(/-/g, "/")];
    for (const candidate of candidates) {
      const hit = candidate ? classify(candidate) : null;
      if (hit) return hit;
    }
  }
  return null;
}

const dependency = (text: string, name: string, needle = name, alternates: string[] = []): Dependency => ({
  name, alternates, line: lineOf(text, needle),
});

function parseNpm(file: RepoFile): Omit<Manifest, "dir" | "file"> | null {
  let json: unknown;
  try {
    json = JSON.parse(file.text);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const pkg = json as Record<string, unknown>;
  const names = [pkg.dependencies, pkg.optionalDependencies].flatMap((d) => (d && typeof d === "object" ? Object.keys(d) : []));
  return {
    kind: "npm",
    name: typeof pkg.name === "string" ? pkg.name : null,
    dependencies: names.map((name) => dependency(file.text, name, `"${name}"`)),
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
  return { kind: "python", name, dependencies: names.map((n) => dependency(file.text, n, `"${n}`)) };
}

function parseRequirements(file: RepoFile): Omit<Manifest, "dir" | "file"> {
  const dependencies: Dependency[] = [];
  file.text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.split("#")[0].trim();
    if (!line || line.startsWith("-")) return; // opções como -r outro.txt ou -e .
    const match = line.match(PEP508_NAME);
    if (match) dependencies.push({ name: match[1], alternates: [], line: index + 1 });
  });
  return { kind: "python", name: null, dependencies };
}

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`))?.[1] ?? null;

function parsePom(file: RepoFile): Omit<Manifest, "dir" | "file"> {
  // sem comentários, sem dependencyManagement (só versões) e sem build (plugins têm as suas dependências)
  const pom = file.text
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<build>[\s\S]*?<\/build>/g, (m) => m.replace(/[^\n]/g, " "));
  const dependencies: Dependency[] = [];
  for (const match of pom.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const group = tag(match[1], "groupId");
    const artifact = tag(match[1], "artifactId");
    if (!artifact || tag(match[1], "scope") === "test") continue;
    const line = lineOf(file.text, `<artifactId>${artifact}</artifactId>`, match.index);
    dependencies.push({ name: artifact, alternates: group ? [group, `${group}.${artifact}`] : [], line });
  }
  const withoutParent = pom.replace(/<parent>[\s\S]*?<\/parent>/, "").replace(/<dependencies>[\s\S]*?<\/dependencies>/g, "");
  return { kind: "maven", name: tag(withoutParent, "artifactId"), dependencies };
}

const GRADLE_DEPENDENCY = /^\s*(?:implementation|api|compile|runtimeOnly|runtime)\s*\(?\s*['"]([\w.-]+):([\w.-]+)(?::[^'"]*)?['"]/;

function parseGradle(file: RepoFile): Omit<Manifest, "dir" | "file"> {
  const dependencies: Dependency[] = [];
  file.text.split(/\r?\n/).forEach((raw, index) => {
    const match = raw.match(GRADLE_DEPENDENCY);
    if (match) dependencies.push({ name: match[2], alternates: [match[1], `${match[1]}.${match[2]}`], line: index + 1 });
  });
  return { kind: "gradle", name: null, dependencies };
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
  return { kind: "go", name, dependencies };
}

function parseCargo(file: RepoFile): Omit<Manifest, "dir" | "file"> | null {
  let toml: Record<string, unknown>;
  try {
    toml = parseToml(file.text) as Record<string, unknown>;
  } catch {
    return null;
  }
  const names = toml.dependencies && typeof toml.dependencies === "object" ? Object.keys(toml.dependencies) : [];
  const pkg = (toml.package ?? {}) as Record<string, unknown>;
  return {
    kind: "cargo",
    name: typeof pkg.name === "string" ? pkg.name : null,
    dependencies: names.map((n) => dependency(file.text, n, n)),
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
