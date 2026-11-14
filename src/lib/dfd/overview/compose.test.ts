import { describe, expect, it } from "vitest";
import { mergeServices, parseCompose, parsePort } from "./compose";

const STACK = `services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: hunter2
  api:
    build:
      context: ./api
      dockerfile: Dockerfile.prod
    ports:
      - "8080:80"
      - "127.0.0.1:9000:9000/tcp"
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgres://app:hunter2@db:5432/app
      - DEBUG
  web:
    build: ./web
    links:
      - api:backend
`;

describe("parseCompose", () => {
  const services = parseCompose({ path: "deploy/docker-compose.yml", text: STACK });
  const byName = (name: string) => services.find((s) => s.name === name)!;

  it("reads every service with the line where it is declared", () => {
    expect(services.map((s) => [s.name, s.line])).toEqual([["db", 2], ["api", 6], ["web", 19]]);
    expect(services.every((s) => s.file === "deploy/docker-compose.yml")).toBe(true);
  });

  it("reads images and resolves build folders against the compose file's folder", () => {
    expect(byName("db").image).toBe("postgres:16");
    expect(byName("db").build).toBeNull();
    expect(byName("api").build).toEqual({ context: "deploy/api", dockerfile: "deploy/api/Dockerfile.prod", sourceDir: "deploy/api" });
    expect(byName("web").build).toEqual({ context: "deploy/web", dockerfile: "deploy/web/Dockerfile", sourceDir: "deploy/web" });
  });

  it("reads depends_on in both forms and links", () => {
    expect(byName("api").dependsOn).toEqual([{ name: "db", file: "deploy/docker-compose.yml", line: 6 }]);
    expect(byName("web").dependsOn.map((d) => d.name)).toEqual(["api"]);
  });

  it("reads published ports", () => {
    expect(byName("api").ports).toEqual([
      { published: 8080, target: 80, public: true, file: "deploy/docker-compose.yml", line: 6 },
      { published: 9000, target: 9000, public: true, file: "deploy/docker-compose.yml", line: 6 },
    ]);
  });

  it("reads environment in both forms, with the line of each variable", () => {
    expect(byName("api").environment.map((e) => [e.key, e.line])).toEqual([["DATABASE_URL", 17], ["DEBUG", 18]]);
    expect(byName("db").environment.map((e) => e.key)).toEqual(["POSTGRES_PASSWORD"]);
  });

  it("follows YAML merge keys used to share configuration", () => {
    const text = `x-base: &base\n  image: python:3.12\n  environment:\n    MODE: prod\nservices:\n  a:\n    <<: *base\n  b:\n    <<: *base\n    image: node:22\n`;
    const parsed = parseCompose({ path: "compose.yml", text });
    expect(parsed.map((s) => [s.name, s.image])).toEqual([["a", "python:3.12"], ["b", "node:22"]]);
    expect(parsed[0].environment.map((e) => e.key)).toEqual(["MODE"]);
  });

  it("gives nothing for files that are not compose files or are broken", () => {
    expect(parseCompose({ path: "compose.yml", text: "version: '3'\n" })).toEqual([]);
    expect(parseCompose({ path: "compose.yml", text: "services: [unclosed\n  - {" })).toEqual([]);
    expect(parseCompose({ path: "compose.yml", text: "" })).toEqual([]);
    expect(parseCompose({ path: "compose.yml", text: "services:\n  empty:\n" }).map((s) => s.name)).toEqual(["empty"]);
  });
});

describe("parsePort", () => {
  it.each([
    ["8080:80", { published: 8080, target: 80, public: true }],
    ["127.0.0.1:8080:80", { published: 8080, target: 80, public: true }],
    ["80", { published: null, target: 80, public: false }],
    ["53:53/udp", { published: 53, target: 53, public: true }],
    ["${PORT:-8000}:8000", { published: null, target: 8000, public: true }],
    ["3000-3005:3000-3005", { published: 3000, target: 3000, public: true }],
    [{ target: 80, published: 8081 }, { published: 8081, target: 80, public: true }],
    [{ target: 80 }, { published: null, target: 80, public: false }],
    [8080, { published: null, target: 8080, public: false }],
  ])("%j", (input, expected) => expect(parsePort(input)).toEqual(expected));

  it("ignores values that are not ports", () => {
    expect(parsePort(null)).toBeNull();
    expect(parsePort(true)).toBeNull();
  });
});

describe("where a built service's code is", () => {
  const sourceOf = (build: string, dir = "") => parseCompose({ path: `${dir}compose.yml`, text: `services:\n  s:\n    build:\n${build}\n` })[0].build;

  it("is next to the Dockerfile when the context is a parent folder (context '.' and backend/Dockerfile)", () => {
    expect(sourceOf("      context: .\n      dockerfile: backend/Dockerfile")).toEqual({ context: ".", dockerfile: "backend/Dockerfile", sourceDir: "backend" });
    expect(sourceOf("      context: ./deploy\n      dockerfile: api/Dockerfile")?.sourceDir).toBe("deploy/api");
  });

  it("counts Dockerfile.<variant> like Dockerfile (frontend/Dockerfile.playwright is the code of frontend/)", () => {
    expect(sourceOf("      context: .\n      dockerfile: frontend/Dockerfile.playwright")?.sourceDir).toBe("frontend");
  });

  it("is the context when the Dockerfile has another kind of name, because the folder then only holds Dockerfiles", () => {
    expect(sourceOf("      context: .\n      dockerfile: docker/api.Dockerfile")?.sourceDir).toBe(".");
    expect(sourceOf("      context: .\n      dockerfile: Dockerfile.prod")?.sourceDir).toBe(".");
  });

  it("is the context when the Dockerfile is outside it", () => {
    expect(sourceOf("      context: ./app\n      dockerfile: ../docker/Dockerfile")?.sourceDir).toBe("app");
  });
});

describe("mergeServices", () => {
  const base = parseCompose({ path: "compose.yml", text: "services:\n  api:\n    image: acme/api\n    ports: ['80:80']\n    depends_on: [db]\n    environment:\n      A: '1'\n      B: '2'\n  db:\n    image: postgres\n" });
  const override = parseCompose({ path: "compose.override.yml", text: "services:\n  api:\n    build: ./api\n    ports: ['8080:80', '80:80']\n    depends_on: [cache]\n    environment:\n      B: '3'\n  frontend:\n    build: ./frontend\n" });

  it("adds services that only exist in an override", () => {
    expect(mergeServices([...base, ...override]).map((s) => s.name)).toEqual(["api", "db", "frontend"]);
  });

  it("combines a service like docker compose does: later image and build win, lists accumulate", () => {
    const api = mergeServices([...base, ...override]).find((s) => s.name === "api")!;
    expect(api.image).toBe("acme/api");
    expect(api.build).toMatchObject({ context: "api" });
    expect(api.ports.map((p) => p.published)).toEqual([80, 8080]);
    expect(api.dependsOn.map((d) => [d.name, d.file])).toEqual([["db", "compose.yml"], ["cache", "compose.override.yml"]]);
    expect(api.ports.map((p) => [p.published, p.file])).toEqual([[80, "compose.yml"], [8080, "compose.override.yml"]]);
    expect(api.environment.map((e) => [e.key, e.value, e.file])).toEqual([["A", "1", "compose.yml"], ["B", "3", "compose.override.yml"]]);
  });

  it("keeps the declaration of the first file where the service appears", () => {
    expect(mergeServices([...base, ...override]).find((s) => s.name === "api")).toMatchObject({ file: "compose.yml", line: 2 });
  });

  it("does not mix services of the same name from different folders", () => {
    const other = parseCompose({ path: "svc/compose.yml", text: "services:\n  api:\n    image: other\n" });
    expect(mergeServices([...base, ...other]).filter((s) => s.name === "api")).toHaveLength(2);
  });
});
