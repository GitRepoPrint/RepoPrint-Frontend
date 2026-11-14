import { describe, expect, it } from "vitest";
import { titleLines } from "./labels";

describe("titleLines", () => {
  it("leaves short titles on one line", () => {
    expect(titleLines("db")).toEqual(["db"]);
    expect(titleLines("User / Client")).not.toEqual([]); // 13 caracteres: já se parte
    expect(titleLines("result")).toEqual(["result"]);
  });

  it("splits at the separator nearest the middle and keeps it at the end of the first line", () => {
    expect(titleLines("customers-service")).toEqual(["customers-", "service"]);
    expect(titleLines("prometheus-server")).toEqual(["prometheus-", "server"]);
    expect(titleLines("User / Client")).toEqual(["User /", "Client"]);
    expect(titleLines("api-gateway-service")).toEqual(["api-gateway-", "service"]);
  });

  it("never gives more than two lines, and none longer than the shape allows", () => {
    for (const title of ["a-very-long-service-name-indeed-yes", "x".repeat(40), "tanstack-start-application-server"]) {
      const lines = titleLines(title);
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(lines.every((line) => line.length <= 14)).toBe(true);
    }
  });

  it("cuts a long title with no separator, with an ellipsis", () => {
    expect(titleLines("abcdefghijklmnopqrstuvwxyz")).toEqual(["abcdefghijklm…"]);
  });

  it("does not split at the very first or last character", () => {
    expect(titleLines("-abcdefghijk")[0].startsWith("-abc")).toBe(true);
    expect(titleLines("abcdefghijkl-")).toHaveLength(1);
  });
});
