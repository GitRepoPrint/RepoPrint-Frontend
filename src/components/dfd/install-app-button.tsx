"use client";

import { APP_NOT_INSTALLED } from "@/lib/dfd/detail";

export function InstallAppButton({ message }: { message: string }) {
  if (message !== APP_NOT_INSTALLED) return null;
  return (
    <button type="button" className="button button-outline" onClick={() => window.location.assign("/api/github/app/install")}>
      Install RepoPrint app
    </button>
  );
}
