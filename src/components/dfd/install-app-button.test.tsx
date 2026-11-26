import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APP_NOT_INSTALLED } from "@/lib/dfd/detail";
import { InstallAppButton } from "./install-app-button";

describe("InstallAppButton", () => {
  it("shows next to the install the app error", () => {
    expect(renderToStaticMarkup(<InstallAppButton message={APP_NOT_INSTALLED} />)).toContain("Install RepoPrint app");
  });

  it("shows nothing for other errors", () => {
    expect(renderToStaticMarkup(<InstallAppButton message="The code analysis failed. Please try again." />)).toBe("");
  });
});
