import type { ReactNode } from "react";

type StatusPanelProps = { title: string; message: string; children: ReactNode };

export function StatusPanel({ title, message, children }: StatusPanelProps) {
  return (
    <main className="mx-auto w-[min(100%-40px,560px)] pb-20 pt-24 text-center">
      <h1 className="mb-3 font-['Space_Grotesk',sans-serif] text-3xl tracking-tight text-(--c-text)">{title}</h1>
      <p className="mb-8 text-[15px] leading-relaxed text-(--c-text-2)">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </main>
  );
}
