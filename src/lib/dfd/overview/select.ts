// Que ficheiros do repositório o overview lê. Só configuração: compose, Dockerfiles, manifestos e ficheiros de
// configuração (ver docs/dfd-schema.md, "Overview v1 inputs"). Nada de código-fonte.
import { basename, dirname } from "./types";

export type FileKind = "compose" | "dockerfile" | "manifest" | "config";

// Pastas que não descrevem o sistema: dependências, resultados de compilação, documentação, exemplos e testes.
export const SKIP_DIRS = new Set([
  "node_modules", "vendor", "dist", "target", "out", ".git", ".venv", "venv", "env", "__pycache__", ".next", ".nuxt",
  "coverage", "third_party", "bower_components", "site-packages", ".idea", ".vscode", ".github",
  "docs", "doc", "documentation", "examples", "example", "samples", "sample",
  "test", "tests", "__tests__", "spec", "specs", "e2e", "fixtures", "testdata",
]);

export const MANIFEST_NAMES = new Set([
  "package.json", "pyproject.toml", "requirements.txt", "pom.xml", "build.gradle", "build.gradle.kts", "go.mod", "Cargo.toml",
]);

const COMPOSE_BASE = /^(docker-)?compose\.ya?ml$/i;
const COMPOSE_ANY = /^(docker-)?compose([.-][\w.-]+)?\.ya?ml$/i;
// docker-compose.test.yml, compose.ci.yml...: montam o sistema para testá-lo, não descrevem o sistema
const TEST_LIKE = /(^|[._-])(test|tests|testing|ci|e2e)([._-]|$)/i;
const MAX_COMPOSE_PER_DIR = 3;
const CONFIG_NAMES = /^(application\.(ya?ml|properties)|\.env\.(example|sample|template)|example\.env)$/i;

// Quantos ficheiros de cada tipo, no máximo, para o número de pedidos ficar pequeno.
const LIMITS: Record<FileKind, number> = { compose: 6, dockerfile: 20, config: 12, manifest: 30 };
const ORDER: FileKind[] = ["compose", "dockerfile", "config", "manifest"];

export function fileKind(path: string): FileKind | null {
  const name = basename(path);
  if (COMPOSE_ANY.test(name)) return "compose";
  if (/^dockerfile(\..+)?$/i.test(name) || /\.dockerfile$/i.test(name)) return "dockerfile";
  if (MANIFEST_NAMES.has(name)) return "manifest";
  if (CONFIG_NAMES.test(name)) return "config";
  return null;
}

const skipped = (path: string) => path.split("/").slice(0, -1).some((part) => SKIP_DIRS.has(part));
const depth = (path: string) => path.split("/").length;

/**
 * Dos caminhos da árvore do repositório, os que se devem descarregar. Os mais perto da raiz primeiro.
 * Compose: só os das pastas mais próximas da raiz (um compose numa subpasta costuma ser de testes ou de um exemplo),
 * sem os de testes, e em cada pasta o de base primeiro e depois os outros (overrides, produção...), até 3.
 * Os overrides juntam-se ao de base (ver mergeServices): às vezes só neles aparece um serviço.
 */
export function selectConfigFiles(paths: string[]): string[] {
  const byKind: Record<FileKind, string[]> = { compose: [], dockerfile: [], manifest: [], config: [] };
  for (const path of [...paths].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))) {
    const kind = skipped(path) ? null : fileKind(path);
    if (kind) byKind[kind].push(path);
  }

  const composes = byKind.compose.filter((path) => !TEST_LIKE.test(basename(path).replace(/\.ya?ml$/i, "")));
  const shallowest = composes.length ? Math.min(...composes.map(depth)) : 0;
  const perDir = new Map<string, string[]>();
  for (const path of composes.filter((p) => depth(p) === shallowest)) perDir.set(dirname(path), [...(perDir.get(dirname(path)) ?? []), path]);
  byKind.compose = [...perDir.values()].flatMap((group) =>
    [...group].sort((a, b) => Number(COMPOSE_BASE.test(basename(b))) - Number(COMPOSE_BASE.test(basename(a))) || a.localeCompare(b)).slice(0, MAX_COMPOSE_PER_DIR),
  );

  return ORDER.flatMap((kind) => byKind[kind].slice(0, LIMITS[kind]));
}
