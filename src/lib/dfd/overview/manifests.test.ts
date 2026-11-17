import { describe, expect, it } from "vitest";
import { MAX_DEPENDENCIES, classifyDependency, parseManifest } from "./manifests";

const parse = (path: string, text: string) => parseManifest({ path, text })!;
const names = (path: string, text: string) => parse(path, text).dependencies.map((d) => d.name);

describe("npm", () => {
  const text = `{\n  "name": "api",\n  "dependencies": {\n    "express": "^4",\n    "pg": "^8"\n  },\n  "devDependencies": {\n    "vitest": "^1"\n  },\n  "optionalDependencies": { "redis": "^4" }\n}\n`;
  it("takes production dependencies, with lines, and skips dev ones", () => {
    const m = parse("apps/api/package.json", text);
    expect(m).toMatchObject({ dir: "apps/api", kind: "npm", name: "api" });
    expect(m.dependencies.map((d) => [d.name, d.line])).toEqual([["express", 4], ["pg", 5], ["redis", 10]]);
  });
  it("tolerates broken JSON", () => expect(parseManifest({ path: "package.json", text: "{ nope" })).toBeNull());
});

describe("python", () => {
  it("reads requirements.txt, skipping options, comments and versions", () => {
    const text = `# deps\nfastapi>=0.100\n-r base.txt\npsycopg2-binary==2.9  # driver\nrequests[security]~=2.3\n\n-e .\n`;
    expect(parse("requirements.txt", text).dependencies.map((d) => [d.name, d.line])).toEqual([["fastapi", 2], ["psycopg2-binary", 4], ["requests", 5]]);
  });
  it("reads pyproject dependencies (PEP 621) and ignores optional groups", () => {
    const text = `[project]\nname = "svc"\ndependencies = ["fastapi>=0.1", "stripe"]\n[project.optional-dependencies]\ndev = ["pytest"]\n`;
    const m = parse("pyproject.toml", text);
    expect(m.name).toBe("svc");
    expect(m.dependencies.map((d) => d.name)).toEqual(["fastapi", "stripe"]);
  });
  it("reads poetry dependencies and drops python itself", () => {
    expect(names("pyproject.toml", `[tool.poetry]\nname = "x"\n[tool.poetry.dependencies]\npython = "^3.12"\nflask = "^3"\n`)).toEqual(["flask"]);
  });
});

describe("maven", () => {
  const pom = `<project>
  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId></parent>
  <artifactId>orders</artifactId>
  <dependencyManagement><dependencies><dependency><groupId>x</groupId><artifactId>managed</artifactId></dependency></dependencies></dependencyManagement>
  <dependencies>
    <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <!-- <dependency><groupId>com.mysql</groupId><artifactId>commented</artifactId></dependency> -->
    <dependency><groupId>junit</groupId><artifactId>junit</artifactId><scope>test</scope></dependency>
  </dependencies>
  <build><plugins><plugin><dependencies><dependency><groupId>a</groupId><artifactId>plugin-dep</artifactId></dependency></dependencies></plugin></plugins></build>
</project>`;
  it("takes the artifact name, production dependencies only, and their lines", () => {
    const m = parse("orders/pom.xml", pom);
    expect(m.name).toBe("orders");
    expect(m.dependencies.map((d) => [d.name, d.line])).toEqual([["postgresql", 6], ["spring-boot-starter-web", 7]]);
  });
  it("recognises databases by groupId and Spring starters by alias", () => {
    const [db, web] = parse("pom.xml", pom).dependencies;
    expect(classifyDependency(db)?.technology).toBe("postgresql");
    expect(classifyDependency(web)?.category).toBe("entrypoint");
  });
});

describe("gradle, go and cargo", () => {
  it("reads gradle dependencies in Groovy and Kotlin syntax, not test ones", () => {
    const text = `dependencies {\n  implementation 'org.postgresql:postgresql:42.7'\n  implementation("redis.clients:jedis:5.1")\n  testImplementation 'junit:junit:4'\n  api "com.stripe:stripe-java:24"\n}\n`;
    expect(parse("build.gradle", text).dependencies.map((d) => [d.name, d.line])).toEqual([["postgresql", 2], ["jedis", 3], ["stripe-java", 5]]);
  });
  it("reads go.mod, skipping indirect dependencies", () => {
    const text = `module example.com/svc\n\nrequire github.com/lib/pq v1.10.9\n\nrequire (\n\tgithub.com/redis/go-redis/v9 v9.5.1\n\tgolang.org/x/text v0.14 // indirect\n)\n`;
    const m = parse("svc/go.mod", text);
    expect(m.name).toBe("example.com/svc");
    expect(m.dependencies.map((d) => d.name)).toEqual(["github.com/lib/pq", "github.com/redis/go-redis/v9"]);
  });
  it("reads Cargo.toml dependencies, not dev or build ones", () => {
    const text = `[package]\nname = "svc"\n[dependencies]\ntokio-postgres = "0.7"\nreqwest = { version = "0.12" }\n[dev-dependencies]\nmockito = "1"\n`;
    const m = parse("Cargo.toml", text);
    expect(m.name).toBe("svc");
    expect(m.dependencies.map((d) => d.name)).toEqual(["tokio-postgres", "reqwest"]);
  });
});

describe("classifyDependency", () => {
  const dep = (name: string, alternates: string[] = []) => classifyDependency({ name, alternates });

  it.each([
    ["pg", "postgresql"], ["psycopg2-binary", "postgresql"], ["tokio-postgres", "postgresql"], ["ioredis", "redis"],
    ["flask-sqlalchemy", "sql-database"], ["google-cloud-storage", "google-cloud"], ["azure-storage-blob", "azure"],
    ["@aws-sdk/client-s3", "aws"], ["kafka-python", "kafka"], ["stripe", "stripe"], ["github.com/lib/pq", "postgresql"],
  ])("%s -> %s", (name, technology) => expect(dep(name)?.technology).toBe(technology));

  it.each(["spring-boot-starter-web", "spring-boot-starter-webmvc", "spring-boot-starter-webflux"])("%s means the service answers HTTP", (artifact) => {
    expect(dep(artifact)?.category).toBe("entrypoint");
  });

  it.each(["react-dom", "vue", "@angular/core", "svelte", "vite", "nuxt"])("%s is a web frontend", (name) => {
    expect(dep(name)).toMatchObject({ category: "entrypoint", technology: "web-frontend" });
  });

  it("spring-cloud-starter-gateway (any version of the name) is a web entry point", () => {
    for (const name of ["spring-cloud-starter-gateway", "spring-cloud-starter-gateway-server-webmvc", "spring-cloud-starter-gateway-server-webflux"]) {
      expect(dep(name)?.category).toBe("entrypoint");
    }
  });

  it("returns null for libraries the catalog does not know", () => {
    expect(dep("lodash")).toBeNull();
    expect(dep("left-pad")).toBeNull();
    expect(dep("pytest")).toBeNull();
  });

  it("tries the alternates when the name alone is not enough", () => {
    expect(dep("some-artifact", ["org.mongodb"])?.technology).toBe("mongodb");
  });
});

describe("hostile files", () => {
  const took = (run: () => unknown) => {
    const start = performance.now();
    run();
    return performance.now() - start;
  };

  it("caps how many dependencies a manifest can contribute", () => {
    const deps = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`pkg${i}`, "1"]));
    expect(parse("package.json", JSON.stringify({ dependencies: deps })).dependencies).toHaveLength(MAX_DEPENDENCIES);
    expect(parse("requirements.txt", Array.from({ length: 5000 }, (_, i) => `p${i}`).join("\n")).dependencies).toHaveLength(MAX_DEPENDENCIES);
  });

  it("reads a pom with unclosed or repeated tags in linear time", () => {
    const hostile = ["<dependency>".repeat(16000), "<!--".repeat(50000), "<build>".repeat(30000), "<dependency><artifactId>" + " ".repeat(190000)];
    for (const text of hostile) expect(took(() => parseManifest({ path: "pom.xml", text }))).toBeLessThan(1500);
  });

  it("an unclosed comment hides the rest of a pom, as an XML parser would", () => {
    const pom = `<project><artifactId>x</artifactId><dependencies><dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId></dependency><!-- never closed <dependency><artifactId>hidden</artifactId></dependency></dependencies></project>`;
    expect(names("pom.xml", pom)).toEqual(["postgresql"]);
  });

  it("classifies a ridiculous name instantly", () => {
    expect(took(() => classifyDependency({ name: "a".repeat(200000), alternates: [] }))).toBeLessThan(500);
  });
});
