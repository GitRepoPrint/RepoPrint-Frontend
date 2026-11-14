import { describe, expect, it } from "vitest";
import { endpointsOf, pairsOf, parseEndpoints } from "./endpoints";

const of = (key: string, value: string) => endpointsOf("f", { key, value, line: 3 });

describe("endpointsOf", () => {
  it("takes the host, port and technology out of a URL and nothing else", () => {
    expect(of("DATABASE_URL", "postgres://app:s3cret-pass@db:5432/app")).toEqual([
      { file: "f", line: 3, key: "DATABASE_URL", host: "db", port: 5432, technology: "postgresql", protocol: "postgres" },
    ]);
  });

  it("never lets a credential, token or password out", () => {
    const found = [
      ...of("DATABASE_URL", "postgres://app:s3cret-pass@db:5432/app"),
      ...of("REDIS_URL", "redis://:tok3n-abc@cache:6379/0"),
      ...of("BROKER", "amqp://guest:gu3st-pw@rabbit"),
      ...of("API", "https://user:p4ss@internal-api:8443/v1?token=qu3ry-secret"),
    ];
    expect(found).toHaveLength(4);
    expect(JSON.stringify(found)).not.toMatch(/s3cret|tok3n|gu3st|p4ss|qu3ry/);
  });

  it.each([
    ["jdbc:postgresql://pg:5432/shop", "pg", "postgresql", 5432],
    ["jdbc:mysql://mysql-host/shop", "mysql-host", "mysql", null],
    ["postgresql+psycopg://app:pw@pg:5432/app", "pg", "postgresql", 5432],
    ["mysql+pymysql://u:p@mysql/app", "mysql", "mysql", null],
    ["mongodb://mongo:27017/app", "mongo", "mongodb", 27017],
    ["mongodb+srv://cluster0.abc.mongodb.net/app", "cluster0.abc.mongodb.net", "mongodb", null],
    ["rediss://cache:6380", "cache", "redis", 6380],
    ["amqp://rabbit", "rabbit", "rabbitmq", null],
  ])("%s", (value, host, technology, port) => {
    expect(of("URL", value)[0]).toMatchObject({ host, technology, port });
  });

  it("keeps http hosts without guessing a technology", () => {
    expect(of("PAYMENTS_URL", "http://payments:8080/api")[0]).toMatchObject({ host: "payments", technology: null, protocol: "http" });
  });

  it("takes a technology from the key when the scheme has none", () => {
    expect(of("REDIS_URL", "http://cache:6379")[0].technology).toBe("redis");
  });

  it("reads plain host values under host-like keys, including comma lists", () => {
    expect(of("POSTGRES_HOST", "db")[0]).toMatchObject({ host: "db", technology: "postgresql", port: null });
    expect(of("spring.kafka.bootstrap-servers", "kafka1:9092, kafka2:9092").map((e) => [e.host, e.port, e.technology])).toEqual([
      ["kafka1", 9092, "kafka"], ["kafka2", 9092, "kafka"],
    ]);
  });

  it("ignores local addresses, unresolved variables and values that are not hosts", () => {
    expect(of("DB_URL", "postgres://localhost:5432/x")).toEqual([]);
    expect(of("DB_URL", "postgres://127.0.0.1/x")).toEqual([]);
    expect(of("DB_URL", "postgres://${DB_HOST}:5432/x")).toEqual([]);
    expect(of("DB_URL", "postgres://$HOST/x")).toEqual([]);
    expect(of("DB_HOST", "${HOST}")).toEqual([]);
    expect(of("DB_HOST", "localhost")).toEqual([]);
    expect(of("DEBUG", "true")).toEqual([]);
    expect(of("MESSAGE_HOST", "not a host at all")).toEqual([]);
  });
});

describe("pairsOf and parseEndpoints", () => {
  it("reads .env files, with export, quotes and comments", () => {
    const pairs = pairsOf({ path: ".env.example", text: `# db\nexport DB_HOST="db"\nPORT=8000\n\nREDIS_URL='redis://cache:6379'\n` });
    expect(pairs).toEqual([
      { key: "DB_HOST", value: "db", line: 2 }, { key: "PORT", value: "8000", line: 3 }, { key: "REDIS_URL", value: "redis://cache:6379", line: 5 },
    ]);
  });

  it("flattens application.yml into dotted keys and finds the datasource", () => {
    const text = `spring:\n  application:\n    name: shop\n  datasource:\n    url: jdbc:postgresql://pg:5432/shop\n    password: top-s3cret\n  kafka:\n    bootstrap-servers: kafka:9092\n`;
    const found = parseEndpoints({ path: "src/main/resources/application.yml", text });
    expect(found.map((e) => [e.key, e.host, e.technology])).toEqual([
      ["spring.datasource.url", "pg", "postgresql"], ["spring.kafka.bootstrap-servers", "kafka", "kafka"],
    ]);
    expect(found[0].line).toBe(5);
    expect(JSON.stringify(found)).not.toContain("top-s3cret");
  });

  it("reads .properties files", () => {
    const found = parseEndpoints({ path: "application.properties", text: `# comment\nspring.redis.host=cache\nspring.datasource.url=jdbc:mysql://mysql:3306/x\n` });
    expect(found.map((e) => [e.host, e.technology])).toEqual([["cache", "redis"], ["mysql", "mysql"]]);
  });

  it("reads every document of a multi-document YAML file (Spring profiles separated by ---)", () => {
    const text = `spring:\n  config:\n    import: optional:configserver:\${CONFIG_SERVER_URL:http://localhost:8888/}\n---\nspring:\n  config:\n    activate:\n      on-profile: docker\n    import: configserver:http://config-server:8888\n`;
    const found = parseEndpoints({ path: "application.yml", text });
    expect(found.map((e) => [e.key, e.host, e.port, e.protocol])).toEqual([["spring.config.import", "config-server", 8888, "http"]]);
  });

  it("gives nothing for broken yaml", () => {
    expect(parseEndpoints({ path: "application.yml", text: "a: [unclosed\n  - {" })).toEqual([]);
  });
});
