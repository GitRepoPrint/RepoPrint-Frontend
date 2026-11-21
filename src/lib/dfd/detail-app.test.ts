import { describe, expect, it } from "vitest";
import votingDetail from "./__fixtures__/voting-detail.json";
import { fetchDetailGraph } from "./detail";

const BASE= "https://api.repoprint.test";
const respond= (status: number, body?: unknown) => async () => new Response(body === undefined ? null : JSON.stringify(body), { status });
const notInstalled= respond(404, { detail: { code: "app_not_installed", message: "Instala a app" } });

describe("a private repository without the app", () => {
  it("tells the user to install the app, on the plain endpoint", async () => {
    await expect(fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: notInstalled })).rejects.toMatchObject({
      message: expect.stringMatching(/Install the RepoPrint app/),
      status: 404,
    });
  });

  it("tells the user to install the app, on the stream", async () => {
    await expect(fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: notInstalled, onProgress: () => {} })).rejects.toMatchObject({
      message: expect.stringMatching(/Install the RepoPrint app/),
    });
  });

  it("keeps the usual not found message for any other 404", async () => {
    await expect(fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: respond(404, { detail: "Repositório não encontrado" }) })).rejects.toThrow(/could not find this repository/);
    await expect(fetchDetailGraph("o", "r", { backendUrl: BASE, fetcher: respond(404) })).rejects.toThrow(/could not find this repository/);
  });

  it("goes through the same-origin proxy when asked to", async () => {
    let url= "";
    await fetchDetailGraph("o", "r", { backendUrl: "/api/backend", fetcher: async (u) => { url= u; return Response.json(votingDetail); } });
    expect(url).toMatch(/^\/api\/backend\/dfd\?url=/);
  });
});
