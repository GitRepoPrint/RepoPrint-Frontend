import { describe, expect, it } from "vitest";
import { LineFinder, basename, dirname, joinPath } from "./types";

describe("paths", () => {
  it("joins POSIX paths and resolves . and ..", () => {
    expect(joinPath("deploy", "./api")).toBe("deploy/api");
    expect(joinPath("deploy", "../services/api")).toBe("services/api");
    expect(joinPath(".", ".")).toBe(".");
    expect(joinPath("a", "..")).toBe(".");
    expect(joinPath("a", "../..")).toBe(".");
  });
  it("splits dirname and basename, with '.' for the repository root", () => {
    expect([dirname("a/b/c.txt"), basename("a/b/c.txt"), dirname("c.txt"), basename("c.txt")]).toEqual(["a/b", "c.txt", ".", "c.txt"]);
  });
});

describe("LineFinder", () => {
  const text = "a: 1\nDB_PORT: 2\nPORT: 3\n  - DEBUG\n  - 'QUOTED=1'\nPORT_FORWARD: 4\n";

  it("gives the line of a position, counting from 1", () => {
    const finder = new LineFinder("one\ntwo\nthree");
    expect([0, 3, 4, 7, 8, 12].map((i) => finder.lineAt(i))).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("finds a key at the start of a line and not inside longer keys", () => {
    const finder = new LineFinder(text);
    expect(finder.findKey("PORT", 0).line).toBe(3); // não é DB_PORT (linha 2)
    expect(finder.findKey("PORT_FORWARD", 0).line).toBe(6);
  });

  it("accepts list items, quotes, a bare key and = as well as :", () => {
    const finder = new LineFinder(text);
    expect(finder.findKey("DEBUG", 0).line).toBe(4);
    expect(finder.findKey("QUOTED", 0).line).toBe(5);
    expect(finder.findKey("a", 0).line).toBe(1);
  });

  it("goes forward from where the last search ended, so repeated keys come out in order", () => {
    const finder = new LineFinder("x:\n  name: a\n  name: b\n  name: c\n");
    expect([finder.findKey("name").line, finder.findKey("name").line, finder.findKey("name").line]).toEqual([2, 3, 4]);
  });

  it("falls back to the start when nothing is found ahead, and to line 1 when nothing is found at all", () => {
    const finder = new LineFinder("a: 1\nb: 2\n");
    expect(finder.findKey("b").line).toBe(2);
    expect(finder.findKey("a").line).toBe(1);
    expect(finder.findKey("nope")).toEqual({ line: 1, index: -1 });
    expect(finder.find("nope")).toEqual({ line: 1, index: -1 });
  });

  it("finds JSON keys anywhere on a line, and not a value that looks like the key", () => {
    const finder = new LineFinder('{\n  "name": "express",\n  "dependencies": { "express": "4", "pg": "8" }\n}');
    expect(finder.findJsonKey("express").line).toBe(3);
    expect(finder.findJsonKey("pg").line).toBe(3);
  });

  it("escapes regular expression characters in keys", () => {
    const finder = new LineFinder("a.b: 1\naxb: 2\n(c): 3\n");
    expect(finder.findKey("a.b", 0).line).toBe(1);
    expect(finder.findKey("(c)", 0).line).toBe(3);
  });

  it("finds plain text from a given position", () => {
    const finder = new LineFinder("x\n<a>1</a>\n<a>2</a>\n");
    expect(finder.find("<a>", 0).line).toBe(2);
    expect(finder.find("<a>", 3).line).toBe(3);
    expect(finder.find("<a>", 12)).toEqual({ line: 1, index: -1 }); // com `from` explícito não volta atrás
  });
});
