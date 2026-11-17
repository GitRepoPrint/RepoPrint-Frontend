// Ficheiros feitos de propósito para atrapalhar: o overview corre no navegador de quem o abre, sobre repositórios de
// qualquer pessoa. Nenhum pode rebentar nem demorar muito. Os limites de tempo são largos para não falhar em máquinas lentas.
import { describe, expect, it } from "vitest";
import { buildOverview, MAX_FILE_CHARS } from "./build";
import { parseCompose } from "./compose";
import { parseDockerfile } from "./dockerfile";
import { endpointsOf, parseEndpoints } from "./endpoints";
import { parseManifest } from "./manifests";
import { selectConfigFiles } from "./select";
import { isDfdGraph } from "../schema";
import { overviewView } from "../project";

const N = 200_000;
const rep = (s: string, n: number) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
const cases: [string, () => unknown][] = [
  ["endpoints: one giant scheme-less token", () => endpointsOf("f", { key: "URL", value: "a://" + "x".repeat(N), line: 1 })],
  ["endpoints: many @ without host", () => endpointsOf("f", { key: "URL", value: "a://" + "u@".repeat(N / 2), line: 1 })],
  ["endpoints: many ://", () => endpointsOf("f", { key: "URL", value: "a://b ".repeat(N / 6), line: 1 })],
  ["endpoints: no-scheme colon run", () => endpointsOf("f", { key: "URL", value: "a:".repeat(N / 2), line: 1 })],
  ["endpoints: host list of commas", () => endpointsOf("f", { key: "BROKERS", value: "a,".repeat(N / 2), line: 1 })],
  ["env file: 200k short lines", () => parseEndpoints({ path: ".env.example", text: rep("K=v://h\n", N) })],
  ["env file: one 200k line", () => parseEndpoints({ path: ".env.example", text: "K=" + "=".repeat(N) })],
  ["yaml: deep flow nesting", () => parseCompose({ path: "compose.yml", text: "services: " + "[".repeat(5000) + "]".repeat(5000) })],
  ["yaml: alias bomb", () => parseCompose({ path: "compose.yml", text: `x: &a [lol,lol,lol,lol,lol,lol,lol,lol,lol]\ny: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]\nz: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]\nw: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]\nv: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]\nservices:\n  a:\n    environment: *e\n` })],
  ["yaml: 7000 services (about the size limit)", () => parseCompose({ path: "compose.yml", text: "services:\n" + Array.from({ length: 7000 }, (_, i) => `  s${i}:\n    image: x\n`).join("") })],
  ["yaml app config: deep block nesting", () => parseEndpoints({ path: "application.yml", text: Array.from({ length: 2000 }, (_, i) => " ".repeat(i) + "a:\n").join("") })],
  ["yaml app config: alias bomb", () => parseEndpoints({ path: "application.yml", text: `x: &a [lol,lol,lol,lol,lol,lol,lol,lol,lol]\ny: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]\nz: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]\nw: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]\nv: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]\nk: *e\n` })],
  ["pom: unclosed dependency tags", () => parseManifest({ path: "pom.xml", text: "<dependency>".repeat(N / 12) })],
  ["pom: whitespace in tags", () => parseManifest({ path: "pom.xml", text: "<dependency><artifactId>" + " ".repeat(N) + "</artifactId></dependency>" })],
  ["pom: many dependencies", () => parseManifest({ path: "pom.xml", text: "<dependencies>" + "<dependency><groupId>g</groupId><artifactId>a</artifactId></dependency>".repeat(3000) + "</dependencies>" })],
  ["pom: comments", () => parseManifest({ path: "pom.xml", text: "<!--".repeat(N / 4) })],
  ["package.json: deep nesting", () => parseManifest({ path: "package.json", text: "[".repeat(5000) + "]".repeat(5000) })],
  ["package.json: 20000 deps", () => parseManifest({ path: "package.json", text: JSON.stringify({ dependencies: Object.fromEntries(Array.from({ length: 20000 }, (_, i) => [`pkg${i}`, "1"])) }) })],
  ["requirements: 200k lines", () => parseManifest({ path: "requirements.txt", text: rep("flask>=1\n", N) })],
  ["requirements: one long line", () => parseManifest({ path: "requirements.txt", text: "a".repeat(N) })],
  ["gradle: long lines", () => parseManifest({ path: "build.gradle", text: "implementation '" + "a".repeat(N) })],
  ["go.mod: 20000 requires", () => parseManifest({ path: "go.mod", text: "require (\n" + rep("example.com/m v1.0.0\n", N) + ")\n" })],
  ["cargo: deep inline tables", () => parseManifest({ path: "Cargo.toml", text: "[dependencies]\na = " + "{b=".repeat(2000) + "1" + "}".repeat(2000) })],
  ["pyproject: long array", () => parseManifest({ path: "pyproject.toml", text: '[project]\ndependencies = [' + '"fastapi",'.repeat(N / 10) + "]" })],
  ["dockerfile: long continuation", () => parseDockerfile("FROM a\nRUN " + "x \\\n".repeat(N / 4))],
  ["dockerfile: huge ARG substitution", () => parseDockerfile("ARG A=" + "${A}".repeat(5000) + "\nFROM ${A}\n")],
  ["select: 100k paths", () => selectConfigFiles(Array.from({ length: 100_000 }, (_, i) => `d${i % 50}/x${i}/package.json`))],
  ["build: 60 big files", () => buildOverview({ owner: "o", repo: "r", files: Array.from({ length: 30 }, (_, i) => ({ path: `s${i}/package.json`, text: JSON.stringify({ dependencies: Object.fromEntries(Array.from({ length: 2000 }, (_, j) => [`pkg${j}`, "1"])) }) })) })],
];

describe("hostile inputs", () => {
  it.each(cases)("%s", (_name, run) => {
    const start = performance.now();
    expect(() => run()).not.toThrow();
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it("buildOverview ignores a file bigger than any real configuration file, and says so", () => {
    const huge = { path: "docker-compose.yml", text: "services:\n  a:\n    image: x\n" + "#".repeat(MAX_FILE_CHARS) };
    const g = buildOverview({ owner: "o", repo: "r", files: [huge, { path: "package.json", text: "{}" }] });
    expect(g.meta.unreadable).toEqual(["docker-compose.yml"]);
    expect(g.nodes.map((n) => n.id)).toEqual(["process:application"]);
  });
});

// Nomes que também são propriedades de todos os objetos de JavaScript. Um repositório hostil pode usá-los de propósito
// (uma imagem "constructor", uma dependência "__proto__"); nenhum pode rebentar a análise nem passar por um nome conhecido.
describe("names that are also properties of every JavaScript object", () => {
  const NAMES = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "prototype", "__defineGetter__"];
  const build = (files: { path: string; text: string }[]) => buildOverview({ owner: "o", repo: "r", files, now: "x" });
  const sound = (g: ReturnType<typeof build>) => {
    expect(isDfdGraph(g)).toBe(true);
    for (const n of g.nodes) expect(typeof n.technology === "string" || n.technology == null).toBe(true);
  };

  it.each(NAMES)("%s as an image", (name) => {
    const g = build([{ path: "compose.yml", text: `services:\n  s:\n    image: ${name}\n    ports: ['80:80']\n` }]);
    sound(g);
    expect(g.nodes.find((n) => n.id === "process:s")).toBeDefined(); // um serviço qualquer, não uma base de dados
  });

  it.each(NAMES)("%s as a compose service, and as something another service depends on", (name) => {
    const g = build([{ path: "compose.yml", text: `services:\n  ${name}:\n    image: postgres\n  other:\n    image: acme/x\n    depends_on: [${name}]\n    environment:\n      DB_HOST: ${name}\n` }]);
    sound(g);
    expect(g.nodes.some((n) => n.name === name && n.kind === "data_store")).toBe(true);
    expect(g.edges.some((e) => e.source === "process:other" && e.target === `data_store:${name}`)).toBe(true);
  });

  it.each(NAMES)("%s as a dependency in every kind of manifest", (name) => {
    const g = build([
      { path: "a/package.json", text: JSON.stringify({ dependencies: { [name]: "1" } }) },
      { path: "b/requirements.txt", text: `${name}\n` },
      { path: "c/pyproject.toml", text: `[project]\ndependencies = ["${name}"]\n` },
      { path: "d/Cargo.toml", text: `[dependencies]\n"${name}" = "1"\n` },
      { path: "e/go.mod", text: `module m\nrequire ${name} v1.0.0\n` },
      { path: "f/build.gradle", text: `dependencies { implementation 'x:${name}:1' }\n` },
      { path: "g/pom.xml", text: `<project><dependencies><dependency><groupId>${name}</groupId><artifactId>${name}</artifactId></dependency></dependencies></project>` },
    ]);
    sound(g);
  });

  it.each(NAMES)("%s as the scheme of a URL in a config file", (name) => {
    const g = build([
      { path: "compose.yml", text: `services:\n  app:\n    image: acme/app\n    environment:\n      URL: ${name}://db:5432/x\n` },
      { path: ".env.example", text: `URL=${name}://cache:6379\n` },
    ]);
    sound(g);
  });

  it.each(NAMES)("%s as the label of an edge in a graph being projected", (name) => {
    const node = (id: string) => ({ id: `process:${id}`, kind: "process" as const, name: id, path: id, provenance: { source: "code" as const, confidence: "medium" as const, evidence: [{ note: "x" }] } });
    const g = { schema_version: "1" as const, repository: { owner: "o", repo: "r" }, level: "detail" as const, nodes: [node("a"), node("b")],
      edges: [{ id: `e:${name}`, source: "process:a", target: "process:b", label: name, provenance: { source: "code" as const, confidence: "medium" as const, evidence: [{ note: "x" }] } }],
      meta: { producer: "backend-detail" as const, generated_at: "x" } };
    expect(() => overviewView(g)).not.toThrow();
    expect(overviewView(g).edges.map((e) => e.label)).toEqual([name]);
  });
});
