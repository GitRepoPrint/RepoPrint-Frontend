import { describe, expect, it, vi } from "vitest";
import { analyzeOverview } from "./index";
import { buildOverview } from "./build";

// Um Dockerfile que faz o parser rebentar: o resto do resultado tem de aguentar.
vi.mock("./dockerfile", async (importOriginal) => {
  const original = await importOriginal<typeof import("./dockerfile")>();
  return { ...original, parseDockerfile: (text: string) => { if (text.includes("BOOM")) throw new Error("boom"); return original.parseDockerfile(text); } };
});

const files = [
  { path: "docker-compose.yml", text: "services:\n  api:\n    build: ./api\n  db:\n    image: postgres\n    ports: ['5432:5432']\n" },
  { path: "api/Dockerfile", text: "FROM python\nBOOM\n" },
  { path: "web/Dockerfile", text: "FROM node\nEXPOSE 3000\n" },
];

describe("a file that cannot be read", () => {
  it("is skipped and reported, and everything else still comes out", () => {
    const g = buildOverview({ owner: "o", repo: "r", files, now: "2026-11-14T12:00:00Z" });
    expect(g.nodes.map((n) => n.id)).toEqual(["process:api", "data_store:db"]);
    expect(g.meta.unreadable).toEqual(["api/Dockerfile"]);
  });

  it("makes the result partial", async () => {
    const fetcher = async (input: string) => {
      if (input.startsWith("https://api.github.com/")) return Response.json({ tree: files.map((f) => ({ path: f.path, type: "blob", size: 10 })) });
      const path = input.replace("https://raw.githubusercontent.com/o/r/HEAD/", "");
      return new Response(files.find((f) => f.path === path)!.text);
    };
    const { partial, graph } = await analyzeOverview("o", "r", { fetcher });
    expect(partial).toBe(true);
    expect(graph.meta.unreadable).toEqual(["api/Dockerfile"]);
  });

  it("does not appear in meta when everything was readable", () => {
    expect(buildOverview({ owner: "o", repo: "r", files: [files[0]] }).meta.unreadable).toBeUndefined();
  });
});
