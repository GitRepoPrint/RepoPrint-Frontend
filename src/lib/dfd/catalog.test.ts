import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import { catalogSize, classify } from "./catalog";
import golden from "./__fixtures__/catalog-golden.json";

describe("catalog", () => {
  it("gives the same answer as the backend for every probe in the golden file", () => {
    // catalog-golden.json é gerado pelo classify() do backend: ver docs/dfd-schema.md
    const wrong = (golden as [string, [string, string, string] | null][]).filter(([input, expected]) => {
      const hit = classify(input);
      const actual = hit ? [hit.category, hit.label, hit.technology] : null;
      return JSON.stringify(actual) !== JSON.stringify(expected);
    });
    expect(wrong).toEqual([]);
    expect(golden.length).toBeGreaterThan(1000);
  });

  it("matches by prefix followed by a separator", () => {
    expect(classify("requests.adapters")?.label).toBe("HTTP API");
    expect(classify("github.com/lib/pq/stdlib")?.technology).toBe("postgresql");
    expect(classify("requests_oauthlib")).toBeNull();
    expect(classify("requestsx")).toBeNull();
    expect(classify("")).toBeNull();
    expect(classify("PSYCOPG2")?.label).toBe("PostgreSQL");
  });

  it("prefers the entry that comes first when several keys match (as the backend does)", () => {
    // "org.springframework.web" e "org.springframework.web.bind" batem ambos em "org.springframework.web.bind.annotation"
    const hits = ["org.springframework.web", "org.springframework.web.bind"].map((k) => classify(`${k}.annotation`)?.label);
    expect(new Set(hits).size).toBe(1);
  });

  it("answers a huge name without scanning it for every catalog entry", () => {
    const start = performance.now();
    expect(classify("a".repeat(500_000))).toBeNull();
    expect(classify("requests." + "x".repeat(500_000))?.label).toBe("HTTP API");
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("loads every module of the shared file", () => {
    expect(catalogSize).toBe(new Set(catalog.entries.flatMap((e) => e.modules.map((m) => m.toLowerCase()))).size);
    expect(catalogSize).toBeGreaterThan(250);
  });

  it("gives datastores and queues technology slugs that cannot collide in the schema ids", () => {
    const ids = catalog.entries.map((e) => `${e.category === "external" ? "external_entity" : "data_store"}:${e.technology}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
