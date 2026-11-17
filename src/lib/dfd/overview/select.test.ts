import { describe, expect, it } from "vitest";
import { fileKind, selectConfigFiles } from "./select";

describe("fileKind", () => {
  it.each([
    ["docker-compose.yml", "compose"], ["compose.yaml", "compose"], ["deploy/docker-compose.prod.yml", "compose"],
    ["Dockerfile", "dockerfile"], ["api/Dockerfile.dev", "dockerfile"], ["web/app.Dockerfile", "dockerfile"],
    ["package.json", "manifest"], ["svc/go.mod", "manifest"], ["Cargo.toml", "manifest"], ["build.gradle.kts", "manifest"],
    ["src/main/resources/application.yml", "config"], ["application.properties", "config"], [".env.example", "config"],
    [".env", null], ["package-lock.json", null], ["src/app.py", null], ["README.md", null],
  ])("%s -> %s", (path, kind) => expect(fileKind(path)).toBe(kind));
});

describe("selectConfigFiles", () => {
  it("keeps configuration only, and nothing under dependency, test, docs or example folders", () => {
    const picked = selectConfigFiles([
      "docker-compose.yml", "api/Dockerfile", "api/package.json", "node_modules/x/package.json", "tests/docker-compose.yml",
      "docs/compose.yml", "examples/demo/package.json", "vendor/go.mod", "src/main.py",
    ]);
    expect(picked).toEqual(["docker-compose.yml", "api/Dockerfile", "api/package.json"]);
  });

  it("takes the base compose file first and then the others of the same folder, at most three", () => {
    const picked = selectConfigFiles(["docker-compose.prod.yml", "docker-compose.override.yml", "docker-compose.yml", "compose.dev.yaml", "compose.staging.yaml"]);
    expect(picked.filter((p) => /compose/.test(p))).toEqual(["docker-compose.yml", "compose.dev.yaml", "compose.staging.yaml"]);
  });

  it("leaves out compose files that only build a stack to test the system", () => {
    const picked = selectConfigFiles(["docker-compose.yml", "docker-compose.test.yml", "compose.ci.yaml", "docker-compose.e2e.yml", "docker-compose.testing.yml"]);
    expect(picked).toEqual(["docker-compose.yml"]);
  });

  it("uses only the compose files closest to the root: one in a subfolder is usually a test or an example", () => {
    expect(selectConfigFiles(["result/docker-compose.yml", "docker-compose.yml", "deploy/compose.prod.yml"])).toEqual(["docker-compose.yml"]);
  });

  it("takes every compose file at the shallowest depth when there is none at the root (one per service folder)", () => {
    expect(selectConfigFiles(["services/b/compose.yml", "services/a/compose.yml", "services/a/deep/er/compose.yml"])).toEqual(["services/a/compose.yml", "services/b/compose.yml"]);
  });

  it("orders by kind and then by depth, so the cap drops the deepest files first", () => {
    const manifests = Array.from({ length: 40 }, (_, i) => `a/b/c/p${i}/package.json`);
    const picked = selectConfigFiles(["package.json", ...manifests, "compose.yml", "x/y/Dockerfile"]);
    expect(picked.slice(0, 3)).toEqual(["compose.yml", "x/y/Dockerfile", "package.json"]);
    expect(picked).toHaveLength(2 + 30);
  });
});
