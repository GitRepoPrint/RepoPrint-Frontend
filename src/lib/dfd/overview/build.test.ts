import { describe, expect, it } from "vitest";
import { isDfdGraph } from "../schema";
import type { DfdGraph, GraphEdge } from "../schema";
import { buildOverview } from "./build";
import type { RepoFile } from "./types";

const build = (files: RepoFile[]): DfdGraph => buildOverview({ owner: "acme", repo: "shop", files, now: "2026-11-14T12:00:00Z" });
const file = (path: string, text: string): RepoFile => ({ path, text });

const ids = (g: DfdGraph) => g.nodes.map((n) => n.id);
const node = (g: DfdGraph, id: string) => g.nodes.find((n) => n.id === id)!;
const edgesOf = (g: DfdGraph) => g.edges.map((e) => `${e.source} -> ${e.target} [${e.label}]`).sort();

// Uma pilha típica: dois serviços web, um worker, uma fila e uma base de dados
const VOTING = file("docker-compose.yml", `services:
  vote:
    build: ./vote
    ports:
      - "5000:80"
    depends_on:
      - redis
  result:
    build: ./result
    ports: ["5001:80"]
    depends_on:
      - db
  worker:
    build: ./worker
    depends_on:
      - redis
      - db
    environment:
      - DATABASE_URL=postgres://postgres:s3cret-pw@db:5432/votes
  redis:
    image: redis:alpine
  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
`);

describe("a compose stack", () => {
  const g = build([VOTING]);

  it("is a valid overview graph", () => {
    expect(isDfdGraph(g)).toBe(true);
    expect(g).toMatchObject({ schema_version: "1", level: "overview", repository: { owner: "acme", repo: "shop" } });
    expect(g.meta).toMatchObject({ producer: "browser-overview", inputs: ["docker-compose.yml"] });
    expect(g.meta.fallback).toBeUndefined();
  });

  it("makes each built service a process and each database or queue image a data store", () => {
    expect(ids(g)).toEqual([
      "process:vote", "process:result", "process:worker", "data_store:redis", "data_store:db", "external_entity:client",
    ]);
    expect(node(g, "process:vote")).toMatchObject({ kind: "process", path: "vote", name: "vote" });
    expect(node(g, "data_store:db")).toMatchObject({ kind: "data_store", technology: "postgresql", tags: [], extra: { composeService: "db" } });
    expect(node(g, "data_store:redis")).toMatchObject({ kind: "data_store", technology: "redis" });
  });

  it("connects services to what they depend on, and the client to what is published", () => {
    expect(edgesOf(g)).toEqual([
      "external_entity:client -> process:result [network access]",
      "external_entity:client -> process:vote [network access]",
      "process:result -> data_store:db [reads/writes]",
      "process:vote -> data_store:redis [reads/writes]",
      "process:worker -> data_store:db [reads/writes]",
      "process:worker -> data_store:redis [reads/writes]",
    ]);
  });

  it("does not expose a database just because it publishes a port for developers", () => {
    expect(g.edges.some((e) => e.target === "data_store:db" && e.source === "external_entity:client")).toBe(false);
  });

  it("records where each thing was declared", () => {
    expect(node(g, "process:vote").provenance).toEqual({ source: "config", confidence: "high", evidence: [{ file: "docker-compose.yml", line: 2, note: "service 'vote'" }] });
    const store = node(g, "data_store:db").provenance;
    expect(store.confidence).toBe("high");
    expect(store.evidence).toContainEqual({ note: "heuristic: image name 'postgres:15-alpine'" });
  });

  it("is more sure of an address it read than of a depends_on", () => {
    const viaAddress = g.edges.find((e) => e.id === "process:worker->data_store:db:reads/writes")!;
    expect(viaAddress.provenance.confidence).toBe("high");
    expect(viaAddress.provenance.evidence.map((e) => e.note)).toEqual(["depends_on db", "DATABASE_URL points at 'db'"]);
    expect(viaAddress.protocol).toBe("postgres");
    expect(g.edges.find((e) => e.id === "process:vote->data_store:redis:reads/writes")!.provenance.confidence).toBe("medium");
  });

  it("never puts a password in the graph", () => {
    expect(JSON.stringify(g)).not.toMatch(/s3cret/);
  });
});

describe("what a compose service becomes", () => {
  it("uses the build folder as the process path, so it can later claim detail nodes", () => {
    const g = build([file("deploy/docker-compose.yml", "services:\n  api:\n    build: ../services/api\n")]);
    expect(node(g, "process:services/api")).toMatchObject({ path: "services/api", name: "api" });
  });

  it("names an image-only service by its service name, with no path", () => {
    const g = build([file("compose.yml", "services:\n  gateway:\n    image: acme/gateway:1\n")]);
    const gateway = node(g, "process:gateway");
    expect(gateway.path).toBeNull();
    expect(gateway.provenance.evidence[0]).toMatchObject({ file: "compose.yml", line: 2 });
  });

  it("gives two services built from the same folder different ids", () => {
    const g = build([file("compose.yml", "services:\n  web:\n    build: .\n  worker:\n    build: .\n")]);
    expect(ids(g).filter((i) => i.startsWith("process:"))).toEqual(["process:.", "process:.-2"]);
  });

  it("treats a proxy as a process tagged proxy", () => {
    const g = build([file("compose.yml", "services:\n  edge:\n    image: nginx:alpine\n    ports: ['80:80']\n")]);
    expect(node(g, "process:edge")).toMatchObject({ kind: "process", technology: "nginx", tags: ["proxy"] });
    expect(edgesOf(g)).toEqual(["external_entity:client -> process:edge [network access]"]);
  });

  it("recognises a database built from a Dockerfile that starts from a database image, with less confidence", () => {
    const g = build([
      file("compose.yml", "services:\n  store:\n    build: ./store\n"),
      file("store/Dockerfile", "FROM postgres:16\nCOPY init.sql /docker-entrypoint-initdb.d/\n"),
    ]);
    expect(node(g, "data_store:store")).toMatchObject({ kind: "data_store", technology: "postgresql" });
    expect(node(g, "data_store:store").provenance.confidence).toBe("medium");
  });

  it("shows a queue as a data store tagged queue, and uses its own flow label", () => {
    const g = build([file("compose.yml", "services:\n  app:\n    build: ./app\n    depends_on: [broker]\n  broker:\n    image: rabbitmq:3\n")]);
    expect(node(g, "data_store:broker").tags).toEqual(["queue"]);
    expect(edgesOf(g)).toEqual(["process:app -> data_store:broker [publishes/consumes]"]);
  });

  it("labels a dependency between two processes 'depends on' and does not draw edges out of a data store", () => {
    const g = build([file("compose.yml", "services:\n  a:\n    build: ./a\n    depends_on: [b]\n  b:\n    build: ./b\n  db:\n    image: postgres\n    depends_on: [a]\n")]);
    expect(edgesOf(g)).toEqual(["process:a -> process:b [depends on]"]);
  });

  it("follows a service-to-service address in an environment variable", () => {
    const g = build([file("compose.yml", "services:\n  web:\n    build: ./web\n    environment:\n      API_URL: http://api:8000\n  api:\n    build: ./api\n")]);
    const edge = g.edges.find((e) => e.source === "process:web")!;
    expect(edge).toMatchObject({ target: "process:api", label: "calls", protocol: "http" });
    expect(edge.provenance.confidence).toBe("high");
  });
});

describe("components without compose", () => {
  const monorepo = [
    file("package.json", `{"name":"root","private":true,"dependencies":{}}`),
    file("apps/api/package.json", `{"name":"api","dependencies":{"express":"4","pg":"8","stripe":"14"},"devDependencies":{"mongodb":"6"}}`),
    file("apps/web/package.json", `{"name":"web","dependencies":{"next":"15"}}`),
    file("apps/web/.env.example", "API_HOST=api\n"),
  ];

  it("makes a component of each folder with a manifest, but not of the workspace root", () => {
    const g = build(monorepo);
    expect(g.meta.fallback).toBe("manifests");
    expect(ids(g).filter((i) => i.startsWith("process:"))).toEqual(["process:apps/api", "process:apps/web"]);
    expect(node(g, "process:apps/api")).toMatchObject({ name: "api", path: "apps/api" });
  });

  it("turns production dependencies into data stores and external services, and ignores dev ones", () => {
    const g = build(monorepo);
    expect(ids(g)).toContain("data_store:postgresql");
    expect(ids(g)).toContain("external_entity:stripe");
    expect(ids(g)).not.toContain("data_store:mongodb");
    expect(edgesOf(g)).toContain("process:apps/api -> data_store:postgresql [reads/writes]");
    expect(edgesOf(g)).toContain("process:apps/api -> external_entity:stripe [calls]");
  });

  it("sends web-framework components requests from the client", () => {
    const g = build(monorepo);
    expect(edgesOf(g)).toEqual(expect.arrayContaining([
      "external_entity:client -> process:apps/api [HTTP requests]", "external_entity:client -> process:apps/web [HTTP requests]",
    ]));
    expect(g.edges.find((e) => e.target === "process:apps/api" && e.source === CLIENT)!.provenance.evidence[0]).toMatchObject({ file: "apps/api/package.json", note: "dependency express" });
  });

  it("assigns a manifest's dependencies to the deepest component that contains it", () => {
    const g = build([
      file("services/pom.xml", "<project><artifactId>services</artifactId></project>"),
      file("services/billing/pom.xml", "<project><artifactId>billing</artifactId><dependencies><dependency><groupId>com.stripe</groupId><artifactId>stripe-java</artifactId></dependency></dependencies></project>"),
      file("services/orders/pom.xml", "<project><artifactId>orders</artifactId></project>"),
    ]);
    expect(edgesOf(g)).toEqual(["process:services/billing -> external_entity:stripe [calls]"]);
  });

  it("falls back to one Application with a client edge when there is a single manifest at the root", () => {
    const g = build([file("pyproject.toml", `[project]\nname = "shop"\ndependencies = ["fastapi", "psycopg2-binary", "stripe", "requests"]\n`)]);
    expect(g.meta.fallback).toBe("application");
    expect(node(g, "process:application")).toMatchObject({ name: "shop", path: ".", provenance: { confidence: "medium" } });
    expect(edgesOf(g)).toEqual([
      "external_entity:client -> process:application [HTTP requests]",
      "process:application -> data_store:postgresql [reads/writes]",
      "process:application -> external_entity:stripe [calls]",
    ]);
    // "requests" é só um cliente HTTP: não diz com quem se fala
    expect(ids(g)).not.toContain("external_entity:http-api");
  });
});

const CLIENT = "external_entity:client";

describe("a repository with no configuration at all", () => {
  it("is one low-confidence Application and nothing else", () => {
    const g = build([]);
    expect(ids(g)).toEqual(["process:application"]);
    expect(node(g, "process:application").provenance).toMatchObject({ confidence: "low", evidence: [{ note: "no compose, Dockerfile or manifest found" }] });
    expect(g.edges).toEqual([]);
  });
});

describe("data stores found through dependencies", () => {
  const stack = (extraDb = "") => [
    file("docker-compose.yml", `services:\n  api:\n    build: ./api\n  db:\n    image: postgres:16\n${extraDb}`),
    file("api/requirements.txt", "psycopg2-binary\n"),
  ];

  it("joins the one compose instance of the same technology instead of adding a second database", () => {
    const g = build(stack());
    expect(ids(g).filter((i) => i.startsWith("data_store:"))).toEqual(["data_store:db"]);
    const edge = g.edges.find((e) => e.source === "process:api")!;
    expect(edge).toMatchObject({ target: "data_store:db", label: "reads/writes" });
    expect(edge.provenance.evidence[0]).toEqual({ file: "api/requirements.txt", line: 1, note: "dependency psycopg2-binary" });
  });

  it("stays a separate, low-confidence node when there are several instances and no way to tell which", () => {
    const g = build(stack("  db2:\n    image: postgres:16\n"));
    expect(ids(g).filter((i) => i.startsWith("data_store:"))).toEqual(["data_store:db", "data_store:db2", "data_store:postgresql"]);
    expect(node(g, "data_store:postgresql").provenance.confidence).toBe("low");
  });

  it("is a medium-confidence anonymous node when no instance is declared", () => {
    const g = build([file("package.json", `{"dependencies":{"mongoose":"8"}}`)]);
    expect(node(g, "data_store:mongodb").provenance.confidence).toBe("medium");
    expect(node(g, "data_store:mongodb").provenance.evidence[0].note).toBe("dependency mongoose");
  });

  it("corroboration from several sources merges into one edge with all the evidence", () => {
    const g = build([
      ...stack(),
      file("api/.env.example", "DATABASE_URL=postgres://u:pw@db:5432/x\n"),
    ]);
    const edge = g.edges.find((e) => e.source === "process:api" && e.target === "data_store:db")!;
    expect(edge.provenance.evidence.map((e) => e.file)).toEqual(["api/requirements.txt", "api/.env.example"]);
    expect(edge.provenance.confidence).toBe("high");
    expect(JSON.stringify(g)).not.toContain("pw@");
  });

  it("reads a database address from application.yml and attaches it to the right component", () => {
    const g = build([
      file("docker-compose.yml", "services:\n  billing:\n    build: ./billing\n  pg:\n    image: postgres\n"),
      file("billing/src/main/resources/application.yml", "spring:\n  datasource:\n    url: jdbc:postgresql://pg:5432/billing\n    password: topsecret\n"),
    ]);
    expect(edgesOf(g)).toEqual(["process:billing -> data_store:pg [reads/writes]"]);
    expect(JSON.stringify(g)).not.toContain("topsecret");
  });
});

describe("Dockerfiles that compose does not build", () => {
  it("make the component reachable from outside through the ports they expose", () => {
    const g = build([file("package.json", `{"name":"svc"}`), file("Dockerfile", "FROM node:22\nEXPOSE 3000\n")]);
    expect(edgesOf(g)).toEqual(["external_entity:client -> process:application [network access]"]);
    expect(g.edges[0].provenance.evidence[0]).toMatchObject({ file: "Dockerfile", note: "EXPOSE 3000" });
  });

  it("do not by themselves expose a service that compose builds, because EXPOSE is not a published port", () => {
    const g = build([file("compose.yml", "services:\n  api:\n    build: ./api\n"), file("api/Dockerfile", "FROM node\nEXPOSE 3000\n")]);
    expect(g.edges).toEqual([]);
    expect(node(g, "process:api").extra).toMatchObject({ expose: [3000] });
  });
});

describe("every item can be traced", () => {
  it("has non-empty evidence on every node and edge, of source config, in any scenario", () => {
    const scenarios = [[VOTING], [], [file("pyproject.toml", `[project]\ndependencies = ["fastapi","redis"]`)]];
    for (const files of scenarios) {
      const g = build(files);
      for (const item of [...g.nodes, ...g.edges] as (typeof g.nodes[number] | GraphEdge)[]) {
        expect(item.provenance.source).toBe("config");
        expect(item.provenance.evidence.length).toBeGreaterThan(0);
      }
      expect(isDfdGraph(g)).toBe(true);
    }
  });

  it("never points an edge at a node that does not exist", () => {
    const g = build([VOTING, file("worker/requirements.txt", "psycopg2\nboto3\nredis\n")]);
    const known = new Set(ids(g));
    expect(g.edges.every((e) => known.has(e.source) && known.has(e.target))).toBe(true);
  });
});

describe("lessons from real repositories", () => {
  // fastapi/full-stack-fastapi-template: build com contexto na raiz, o frontend só num override
  const template = [
    file("compose.yml", `services:
  db:
    image: postgres:18
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    depends_on:
      - db
    environment:
      - SQLALCHEMY_DATABASE_URI=postgresql+psycopg://app:pw@db:5432/app
`),
    file("compose.override.yml", `services:
  backend:
    ports:
      - "8000:8000"
  frontend:
    build:
      context: ./frontend
`),
    file("backend/pyproject.toml", `[project]\nname = "app"\ndependencies = ["fastapi", "sqlmodel", "sentry-sdk"]\n`),
    file("frontend/package.json", `{"name":"frontend","dependencies":{"react":"19"}}`),
    file("package.json", `{"name":"root","dependencies":{"express":"4"}}`),
  ];

  it("gives a service built from the repository root the folder of its Dockerfile, not '.'", () => {
    const g = build(template);
    expect(node(g, "process:backend")).toMatchObject({ path: "backend", name: "backend" });
    expect(ids(g)).not.toContain("process:.");
  });

  it("finds services that only an override file declares, and reads published ports from the override", () => {
    const g = build(template);
    expect(ids(g)).toContain("process:frontend");
    // o backend usa FastAPI, por isso os pedidos são HTTP; a porta publicada só reforça a prova
    const edge = g.edges.find((e) => e.id === "external_entity:client->process:backend:HTTP requests")!;
    expect(edge).toBeDefined();
    expect(edge.provenance.evidence).toContainEqual({ file: "compose.override.yml", line: 2, note: "published port 8000" });
  });

  it("links an ORM dependency to the SQL database it already knows instead of inventing a vague one", () => {
    const g = build(template);
    expect(ids(g)).not.toContain("data_store:sql-database");
    expect(edgesOf(g)).toContain("process:backend -> data_store:db [reads/writes]");
  });

  it("keeps a vague 'SQL database' node when there is no instance to link it to", () => {
    const g = build([file("package.json", `{"dependencies":{"sequelize":"6"}}`)]);
    expect(node(g, "data_store:sql-database")).toMatchObject({ technology: "sql-database" });
  });

  it("keeps it too (low confidence) when it cannot tell which of several SQL databases is meant", () => {
    const g = build([
      file("compose.yml", "services:\n  app:\n    build: ./app\n  a:\n    image: postgres\n  b:\n    image: mysql\n"),
      file("app/package.json", `{"dependencies":{"sequelize":"6"}}`),
    ]);
    expect(node(g, "data_store:sql-database").provenance.confidence).toBe("low");
  });

  it("recognises a postgresql+driver URL as PostgreSQL and attributes the evidence to the file it came from", () => {
    const g = build(template);
    const edge = g.edges.find((e) => e.id === "process:backend->data_store:db:reads/writes")!;
    expect(edge.provenance.evidence.map((e) => e.note)).toContain("SQLALCHEMY_DATABASE_URI points at 'db'");
    expect(edge.protocol).toBe("postgresql+psycopg");
  });

  it("does not own dependencies of a manifest outside every service (the workspace root)", () => {
    const g = build(template);
    expect(g.edges.some((e) => e.target.includes("express"))).toBe(false);
    expect(g.edges.filter((e) => e.source === CLIENT).map((e) => e.target)).not.toContain("process:.");
  });
});

describe("services that only name an image", () => {
  const compose = (services: string) => file("docker-compose.yml", `services:\n${services}`);
  const pom = (name: string, deps = "") => file(`${name}/pom.xml`, `<project><artifactId>${name}</artifactId><dependencies>${deps}</dependencies></project>`);
  const web = `<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-webmvc</artifactId></dependency>`;

  it("finds the code in the folder named like the image, and with it the dependencies and the HTTP framework", () => {
    const g = build([
      compose("  customers-service:\n    image: springcommunity/shop-customers-service\n    ports: ['8081:8081']\n"),
      pom("shop-customers-service", web),
    ]);
    expect(node(g, "process:shop-customers-service")).toMatchObject({ name: "customers-service", path: "shop-customers-service" });
    expect(node(g, "process:shop-customers-service").provenance.confidence).toBe("medium");
    expect(node(g, "process:shop-customers-service").provenance.evidence[1].note).toMatch(/heuristic: folder 'shop-customers-service'/);
    expect(edgesOf(g)).toEqual(["external_entity:client -> process:shop-customers-service [HTTP requests]"]);
  });

  it("falls back to a folder named like the service, then to one ending in -<service>", () => {
    const named = build([compose("  billing:\n    image: acme/x\n"), pom("billing")]);
    expect(node(named, "process:billing").path).toBe("billing");
    const suffix = build([compose("  billing:\n    image: acme/x\n"), pom("shop-billing")]);
    expect(node(suffix, "process:shop-billing").path).toBe("shop-billing");
  });

  it("does not guess when two folders fit equally well", () => {
    const g = build([compose("  billing:\n    image: acme/x\n"), pom("shop-billing"), pom("old-billing")]);
    expect(node(g, "process:billing").path).toBeNull();
  });

  it("leaves databases alone: an image that is a database is never matched to a folder", () => {
    const g = build([compose("  db:\n    image: postgres\n"), pom("db")]);
    expect(node(g, "data_store:db").kind).toBe("data_store");
  });

  it("reads the address of another service from a multi-document application.yml, for the folder it was matched to", () => {
    const g = build([
      compose("  config-server:\n    image: acme/shop-config-server\n  customers:\n    image: acme/shop-customers\n"),
      pom("shop-config-server"), pom("shop-customers"),
      file("shop-customers/src/main/resources/application.yml", "spring:\n  application:\n    name: customers\n---\nspring:\n  config:\n    import: configserver:http://config-server:8888\n"),
    ]);
    const edge = g.edges.find((e) => e.source === "process:shop-customers")!;
    expect(edge).toMatchObject({ target: "process:shop-config-server", label: "calls", protocol: "http" });
    expect(edge.provenance.evidence[0]).toMatchObject({ file: "shop-customers/src/main/resources/application.yml", note: "spring.config.import points at 'config-server'" });
  });
});

describe("workspaces without compose", () => {
  const ws = [
    file("package.json", `{"name":"root","private":true}`),
    file("apps/web/package.json", `{"name":"@acme/web","dependencies":{"next":"15","@acme/api":"workspace:*"}}`),
    file("apps/mobile/package.json", `{"name":"@acme/mobile","dependencies":{"expo":"52","@acme/api":"workspace:*"}}`),
    file("packages/api/package.json", `{"name":"@acme/api","dependencies":{"@acme/db":"workspace:*","zod":"3"}}`),
    file("packages/db/package.json", `{"name":"@acme/db","dependencies":{"pg":"8","stripe":"14"}}`),
    file("tooling/eslint/package.json", `{"name":"@acme/eslint","dependencies":{}}`),
  ];

  it("makes components of the things that run (apps/*, or with a web framework) and not of libraries or tooling", () => {
    const g = build(ws);
    expect(g.meta.fallback).toBe("manifests");
    expect(ids(g).filter((i) => i.startsWith("process:"))).toEqual(["process:apps/web", "process:apps/mobile"]);
  });

  it("gives an app what the libraries it depends on use, through any number of workspace links", () => {
    const g = build(ws);
    for (const app of ["process:apps/web", "process:apps/mobile"]) {
      expect(edgesOf(g)).toContain(`${app} -> data_store:postgresql [reads/writes]`);
      expect(edgesOf(g)).toContain(`${app} -> external_entity:stripe [calls]`);
    }
  });

  it("only the app that has a web framework itself receives HTTP requests", () => {
    const g = build(ws);
    expect(edgesOf(g).filter((e) => e.startsWith(CLIENT))).toEqual(["external_entity:client -> process:apps/web [HTTP requests]"]);
  });

  it("a package outside apps/ is a component too when it has a web framework of its own (it is a server)", () => {
    const g = build([...ws, file("packages/server/package.json", `{"name":"@acme/server","dependencies":{"express":"4"}}`)]);
    expect(ids(g).filter((i) => i.startsWith("process:"))).toEqual(["process:apps/web", "process:apps/mobile", "process:packages/server"]);
    expect(edgesOf(g)).toContain("external_entity:client -> process:packages/server [HTTP requests]");
  });

  it("does not make an app answer HTTP just because a library it depends on has a web framework", () => {
    const g = build([
      file("apps/cli/package.json", `{"name":"cli","dependencies":{"@acme/http":"workspace:*"}}`),
      file("packages/http/package.json", `{"name":"@acme/http","dependencies":{"express":"4"}}`),
    ]);
    expect(edgesOf(g).filter((e) => e.startsWith(CLIENT))).toEqual(["external_entity:client -> process:packages/http [HTTP requests]"]);
  });

  it("points the evidence at the library manifest where the dependency is", () => {
    const g = build(ws);
    const edge = g.edges.find((e) => e.source === "process:apps/web" && e.target === "data_store:postgresql")!;
    expect(edge.provenance.evidence[0]).toMatchObject({ file: "packages/db/package.json", note: "dependency pg" });
  });

  it("is one Application when nothing in the repository looks like something that runs", () => {
    const g = build([file("packages/a/package.json", `{"name":"a","dependencies":{"pg":"8"}}`), file("packages/b/package.json", `{"name":"b"}`)]);
    expect(g.meta.fallback).toBe("application");
    expect(edgesOf(g)).toEqual(["process:application -> data_store:postgresql [reads/writes]"]);
  });

  it("copes with libraries that depend on each other in a loop", () => {
    const g = build([
      file("apps/x/package.json", `{"name":"x","dependencies":{"a":"1"}}`),
      file("packages/a/package.json", `{"name":"a","dependencies":{"b":"1","pg":"8"}}`),
      file("packages/b/package.json", `{"name":"b","dependencies":{"a":"1"}}`),
    ]);
    expect(edgesOf(g)).toEqual(["process:apps/x -> data_store:postgresql [reads/writes]"]);
  });
});

describe("generic database dependencies do not depend on reading order", () => {
  const spring = (first: string, second: string) =>
    file("svc/pom.xml", `<project><artifactId>svc</artifactId><dependencies>${first}${second}</dependencies></project>`);
  const jpa = `<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>`;
  const mysql = `<dependency><groupId>com.mysql</groupId><artifactId>mysql-connector-j</artifactId></dependency>`;
  const web = `<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>`;

  it.each([["jpa first", jpa, mysql], ["mysql first", mysql, jpa]])("%s: the ORM joins the specific database", (_, first, second) => {
    const g = build([spring(first, second), spring(web, "")].slice(0, 1));
    expect(ids(g).filter((i) => i.startsWith("data_store:"))).toEqual(["data_store:mysql"]);
  });
});

describe("what the diagram leaves out, and why", () => {
  const compose = (services: string) => file("docker-compose.yml", `services:\n${services}`);

  it("skips services that only test the system", () => {
    const g = build([compose("  api:\n    build: ./api\n  playwright:\n    build: ./e2e\n    depends_on: [api]\n  e2e-tests:\n    image: acme/x\n  runner:\n    image: cypress/included:13\n  contest-api:\n    build: ./c\n")]);
    expect(ids(g)).toEqual(["process:api", "process:c"]);
  });

  it("looks at the whole image path, but not at the registry or the tag", () => {
    const g = build([compose("  a:\n    image: registry.test.local/acme/api:1\n  b:\n    image: localhost:5000/acme/web\n  c:\n    image: acme/api:e2e\n  d:\n    image: mcr.microsoft.com/playwright:v1.49\n")]);
    expect(ids(g)).toEqual(["process:a", "process:b", "process:c"]);
  });

  it("does not take a word that merely contains 'test' for a test runner", () => {
    const g = build([compose("  latest:\n    build: ./a\n  contest:\n    build: ./b\n  attestation:\n    build: ./c\n")]);
    expect(ids(g)).toHaveLength(3);
  });

  it("does not draw edges to or from a skipped test runner", () => {
    const g = build([compose("  api:\n    build: ./api\n    depends_on: [selenium]\n  selenium:\n    image: selenium/standalone-chrome\n    ports: ['4444:4444']\n")]);
    expect(g.edges).toEqual([]);
  });

  it("treats a web frontend as something that answers HTTP", () => {
    const g = build([file("frontend/package.json", `{"name":"ui","dependencies":{"react-dom":"19","vite":"6"}}`)]);
    expect(edgesOf(g)).toEqual(["external_entity:client -> process:frontend [HTTP requests]"]);
  });

  it("treats the Spring Cloud Gateway as an entry point", () => {
    const pom = `<project><artifactId>gw</artifactId><dependencies><dependency><groupId>org.springframework.cloud</groupId><artifactId>spring-cloud-starter-gateway-server-webmvc</artifactId></dependency></dependencies></project>`;
    const g = build([file("services/gateway/pom.xml", pom)]);
    expect(edgesOf(g)).toEqual(["external_entity:client -> process:services/gateway [HTTP requests]"]);
  });

  it("when some components are known to answer HTTP, a port published by another one is not an entry point", () => {
    const g = build([
      compose("  web:\n    build: ./web\n    ports: ['80:80']\n  tool:\n    image: acme/tool\n    ports: ['9000:9000']\n"),
      file("web/package.json", `{"dependencies":{"express":"4"}}`),
    ]);
    expect(edgesOf(g)).toEqual(["external_entity:client -> process:web [HTTP requests]"]);
    expect(node(g, "process:tool").extra).toMatchObject({ ports: [9000] }); // o nó continua a saber da porta
  });

  it("but a proxy always is one", () => {
    const g = build([
      compose("  edge:\n    image: traefik:v3\n    ports: ['80:80']\n  web:\n    build: ./web\n"),
      file("web/package.json", `{"dependencies":{"express":"4"}}`),
    ]);
    expect(edgesOf(g)).toEqual(expect.arrayContaining(["external_entity:client -> process:edge [network access]", "external_entity:client -> process:web [HTTP requests]"]));
  });

  it("and when nothing is known to answer HTTP, the published ports are all there is", () => {
    const g = build([compose("  a:\n    image: acme/a\n    ports: ['8080:80']\n  b:\n    image: acme/b\n    ports: ['8081:80']\n")]);
    expect(edgesOf(g)).toEqual(["external_entity:client -> process:a [network access]", "external_entity:client -> process:b [network access]"]);
  });
});
