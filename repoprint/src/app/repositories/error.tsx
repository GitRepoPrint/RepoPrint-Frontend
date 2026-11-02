"use client"; // Os error boundaries têm de ser Client Components

import Link from "next/link";
import { useEffect } from "react";
import { errorMessage } from "@/lib/api/errors";

// Next.js 16: as props são `error` (unknown) e `retry` (antes chamava-se `reset`).
// Apanha erros da lista, do dashboard e do canvas (ex.: o backend falhou ao devolver a análise).
export default function RepositoriesError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-[min(100%-40px,560px)] pb-20 pt-24 text-center">
      <h1 className="mb-3 font-['Space_Grotesk',sans-serif] text-3xl tracking-tight text-[#f0edf8] [.theme-light_&]:text-[#26263b]">
        Something went wrong
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-[#999bab] [.theme-light_&]:text-[#6f7586]">
        {errorMessage(error, "We could not load this repository analysis. Please try again in a moment.")}
      </p>
      <div className="flex justify-center gap-3">
        <button type="button" className="button button-primary" onClick={() => retry()}>Try again</button>
        <Link href="/repositories" className="button button-outline">Back to repositories</Link>
      </div>
    </main>
  );
}
