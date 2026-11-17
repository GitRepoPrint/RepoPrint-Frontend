import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect= vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
const peekSession= vi.fn();
const fetchGitAnalysis= vi.fn();

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ peekSession }));
vi.mock("./git-analysis", () => ({ fetchGitAnalysis }));

const { getRepositoryAnalysis, isDemoRepository }= await import("./analysis");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isDemoRepository", () => {
  it("recognizes the demo repositories regardless of case", () => {
    expect(isDemoRepository("deti-org/payment-service")).toBe(true);
    expect(isDemoRepository("Deti-Org/Payment-Service")).toBe(true);
    expect(isDemoRepository("marta-costa/infra-toolkit")).toBe(true);
  });

  it("treats any other repository as real", () => {
    expect(isDemoRepository("pallets/click")).toBe(false);
  });
});

describe("getRepositoryAnalysis", () => {
  it("serves the demo with the mock and never calls the backend", async () => {
    const load= await getRepositoryAnalysis("deti-org/payment-service", "/repositories/x");

    expect(load.status).toBe("ready");
    if (load.status === "ready") {
      expect(load.analysis.source).toBe("demo");
      expect(load.analysis.repository).toBe("deti-org/payment-service");
    }
    expect(peekSession).not.toHaveBeenCalled();
    expect(fetchGitAnalysis).not.toHaveBeenCalled();
  });

  it("reads a real repository with the access token", async () => {
    peekSession.mockResolvedValue({ status: "active", accessToken: "tok" });
    fetchGitAnalysis.mockResolvedValue({ status: "not-found" });

    expect(await getRepositoryAnalysis("pallets/click", "/repositories/x")).toEqual({ status: "not-found" });
    expect(fetchGitAnalysis).toHaveBeenCalledWith("pallets/click", "tok");
  });

  it("passes a failure through as a value", async () => {
    const failure= { title: "t", message: "m", retryable: true };
    peekSession.mockResolvedValue({ status: "active", accessToken: "tok" });
    fetchGitAnalysis.mockResolvedValue({ status: "failed", failure });

    expect(await getRepositoryAnalysis("pallets/click", "/repositories/x")).toEqual({ status: "failed", failure });
  });

  it("sends an anonymous visitor to the login", async () => {
    peekSession.mockResolvedValue({ status: "anonymous" });

    await expect(getRepositoryAnalysis("pallets/click", "/repositories/a--b")).rejects.toThrow("redirect:/login?next=%2Frepositories%2Fa--b");
    expect(fetchGitAnalysis).not.toHaveBeenCalled();
  });

  it("renews an expired access token through the refresh route", async () => {
    peekSession.mockResolvedValue({ status: "stale" });

    await expect(getRepositoryAnalysis("pallets/click", "/repositories/a--b")).rejects.toThrow(
      "redirect:/api/auth/refresh?next=%2Frepositories%2Fa--b",
    );
    expect(fetchGitAnalysis).not.toHaveBeenCalled();
  });

  it("drops the session when the backend rejects the token", async () => {
    peekSession.mockResolvedValue({ status: "active", accessToken: "tok" });
    fetchGitAnalysis.mockResolvedValue({ status: "unauthorized" });

    await expect(getRepositoryAnalysis("pallets/click", "/repositories/a--b")).rejects.toThrow(
      "redirect:/api/auth/refresh?next=%2Frepositories%2Fa--b&reason=invalid",
    );
  });
});
