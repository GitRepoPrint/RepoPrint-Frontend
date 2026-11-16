"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LoadFailure } from "@/lib/api/types";
import { StatusPanel } from "./status-panel";

export function LoadFailureView({ failure }: { failure: LoadFailure }) {
  const router= useRouter();
  return (
    <StatusPanel title={failure.title} message={failure.message}>
      {failure.retryable && (
        <button type="button" className="button button-primary" onClick={() => router.refresh()}>Try again</button>
      )}
      <Link href="/repositories" className="button button-outline">Back to repositories</Link>
    </StatusPanel>
  );
}
