import { describe, expect, it } from "vitest";
import { parseDockerfile } from "./dockerfile";

describe("parseDockerfile", () => {
  it("takes the base image of the last stage, following stage names", () => {
    const info = parseDockerfile(`FROM node:22 AS build\nRUN npm ci\nFROM build AS test\nFROM nginx:1.27\nEXPOSE 80\n`);
    expect(info.base).toBe("nginx:1.27");
    expect(info.baseLine).toBe(4);
  });

  it("follows an alias back to its image", () => {
    expect(parseDockerfile("FROM postgres:16 AS db\nFROM db\n").base).toBe("postgres:16");
  });

  it("resolves ARG defaults used in FROM, and gives up on the ones it cannot", () => {
    expect(parseDockerfile("ARG BASE=postgres:16\nFROM ${BASE}\n").base).toBe("postgres:16");
    expect(parseDockerfile("ARG V=3\nFROM python:${V}-slim\n").base).toBe("python:3-slim");
    expect(parseDockerfile("FROM ${UNKNOWN}\n").base).toBeNull();
    expect(parseDockerfile("FROM --platform=$BUILDPLATFORM golang:1.23\n").base).toBe("golang:1.23");
  });

  it("collects EXPOSE ports from every form and ignores variables", () => {
    expect(parseDockerfile("FROM a\nEXPOSE 80 443/tcp 5353/udp $PORT\nEXPOSE 8080\n").expose).toEqual([80, 443, 5353, 8080]);
  });

  it("joins continued lines and skips comments in the middle of them", () => {
    const info = parseDockerfile("# build\nFROM \\\n  # a comment\n  python:3.12\nEXPOSE 8000\n");
    expect(info.base).toBe("python:3.12");
    expect(info.baseLine).toBe(2);
  });

  it("copes with no FROM at all", () => {
    expect(parseDockerfile("")).toEqual({ base: null, baseLine: null, expose: [] });
  });
});
