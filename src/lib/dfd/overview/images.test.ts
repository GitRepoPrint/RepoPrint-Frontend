import { describe, expect, it } from "vitest";
import { CATALOG_TECHNOLOGIES, OVERVIEW_ONLY, classifyImage, imageName, knownTechnologies } from "./images";

describe("imageName", () => {
  it.each([
    ["postgres:16", "postgres"], ["docker.io/library/postgres", "postgres"], ["ghcr.io/acme/Redis:7@sha256:abc", "redis"],
    ["bitnami/kafka:3.7", "kafka"], ["registry.local:5000/team/api:1.2", "api"],
  ])("%s -> %s", (image, name) => expect(imageName(image)).toBe(name));
});

describe("classifyImage", () => {
  it("recognises databases and queues, with the same technology slug the backend uses", () => {
    expect(classifyImage("postgres:16-alpine")).toEqual({ kind: "data_store", technology: "postgresql", tags: [] });
    expect(classifyImage("rabbitmq:3-management")).toEqual({ kind: "data_store", technology: "rabbitmq", tags: ["queue"] });
    expect(classifyImage("confluentinc/cp-kafka:7")).toMatchObject({ technology: "kafka", tags: ["queue"] });
    expect(classifyImage("mariadb:11")?.technology).toBe("mysql");
  });

  it("recognises proxies as processes", () => {
    expect(classifyImage("nginx:alpine")).toEqual({ kind: "process", technology: "nginx", tags: ["proxy"] });
    expect(classifyImage("traefik:v3")?.tags).toEqual(["proxy"]);
  });

  it("does not mistake tools around a database for the database", () => {
    for (const image of ["postgres-exporter:1", "adminer", "redis-commander", "myorg/api:1", "", "${IMAGE}"]) {
      expect(classifyImage(image)).toBeNull();
    }
  });

  it("returns a copy, so callers cannot change the table", () => {
    classifyImage("rabbitmq")!.tags.push("x");
    expect(classifyImage("rabbitmq")!.tags).toEqual(["queue"]);
  });

  it("every technology is either in the shared catalog or declared overview-only", () => {
    const unknown = knownTechnologies().filter((t) => !CATALOG_TECHNOLOGIES.has(t) && !OVERVIEW_ONLY.has(t));
    expect(unknown).toEqual([]);
    expect(knownTechnologies().filter((t) => OVERVIEW_ONLY.has(t) && CATALOG_TECHNOLOGIES.has(t))).toEqual([]);
  });
});
